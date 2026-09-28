/**
 * @file `content.ts`
 * @author Keith Choison <keith@tize.io>
 * @since 0.1.0
 */

import {
  type ShowdexEventDetail,
  createShowdexEvent,
  env,
  getShowdexEventName,
} from '@showdex/utils/core';
import { logger } from '@showdex/utils/debug';

interface ContentInjectable<T = unknown> {
  id: string;
  component: keyof React.JSX.IntrinsicElements;
  into: keyof React.JSX.IntrinsicElements;
  props?: Partial<T extends keyof React.JSX.IntrinsicElements ? React.JSX.IntrinsicElements[T] : T>;
}

const l = logger('@showdex/content');

const { runtime } = chrome || browser;

if (typeof document === 'undefined' || !runtime?.id) {
  l.error('Extension will not run properly since no valid runtime.id was found!');

  throw new Error('Did you forget this is a WebExtension? :o');
}

// obtain the extension runtime ID with this one simple trick
// (using runtime.id will work on Chrome, but not on Firefox since it'll return the ID defined in the manifest)
// (e.g., 'chrome-extension://dabpnahpcemkfbgfbmegmncjllieilai/main.js', 'moz-extension://81b2e17b-928f-4689-a33f-501eae139258/main.js')
const mainUrl = runtime.getURL('main.js');

const extensionId = mainUrl?.endsWith('main.js')
  ? mainUrl.split('/')[2] // e.g., ['chrome-extension:', '', 'dabpnahpcemkfbgfbmegmncjllieilai', 'main.js']
  : runtime.id;

const injectables: ContentInjectable<HTMLElement>[] = [
  {
    id: 'showdex-script-main',
    component: 'script',
    into: 'body',
    props: {
      src: mainUrl,
      async: true,
      'data-ext-id': extensionId,
    },
  } as ContentInjectable<HTMLScriptElement>,
];

// Work Sans & Fira Code are bundled with the extension instead of loaded from Google Fonts, since a host page's
// Content Security Policy (e.g., play.soupstore.dev's `font-src 'self'`) can block the latter
const fontFaces: [family: string, file: string, style: string, weight: string][] = [
  ['Work Sans', 'work-sans-latin-wght-normal.woff2', 'normal', '100 900'],
  ['Work Sans', 'work-sans-latin-wght-italic.woff2', 'italic', '100 900'],
  ['Fira Code', 'fira-code-latin-wght-normal.woff2', 'normal', '300 700'],
];

const fontStyleId = 'showdex-stylesheet-fonts';

if (!document.getElementById(fontStyleId)) {
  const fontStyle = document.createElement('style');

  fontStyle.id = fontStyleId;
  fontStyle.textContent = fontFaces.map(([family, file, style, weight]) => (
    `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;`
      + `src:url('${runtime.getURL(file)}') format('woff2');}`
  )).join('\n');

  document.head.appendChild(fontStyle);
}

l.info(
  'Starting Showdex for', env('build-target', 'probably chrome??'),
  'w/ extension ID', extensionId, '& runtime.id', runtime.id,
);

l.debug('Injecting the following injectables:', injectables);

injectables.forEach(({
  id,
  component,
  into,
  props,
}) => {
  const source = document.getElementById(id) || document.createElement(component);
  const destination = into === 'head' ? document.head : document.body;

  if (source.id !== id) {
    source.id = id;
  }

  Object.entries(props).forEach(([key, value]) => {
    if (value !== undefined) {
      source.setAttribute(key, value as string);
    }
  });

  // l.debug('Injecting', source, 'into', destination, 'with props', props);

  destination.appendChild(source);
});

// Firefox needs this for importing settings from the clipboard
// cause they don't support navigator.clipboard.getText() yet lmao
// (at the time of writing of course)

// found this at the wayyyy bottom of the MDN docs for readText(),
// specifically in the browser compatibility section after clicking on the lil asterisk:
// https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/readText#browser_compatibility
// "Firefox only supports reading the clipboard in browser extensions,
// "using the "clipboardRead" extension permission." ... LOL
if (env('build-target') === 'firefox') {
  l.debug('Adding onShowdexRequest event handler');

  window.addEventListener(getShowdexEventName('request'), (e: CustomEvent<ShowdexEventDetail>) => {
    l.debug(
      'Received onShowdexRequest event', e?.detail?.type || '(missing event.detail.type)',
      '\n', 'event', e,
    );

    if (e?.detail?.type !== 'clipboardReadText') {
      return;
    }

    void (async () => {
      l.debug(
        'Sending message to background script via browser.runtime.sendMessage()',
        '\n', 'event.detail.type', e.detail.type,
        '\n', 'event', e,
      );

      try {
        const response = await navigator.clipboard.readText();

        l.debug(
          'Firing onShowdexResponse for', e.detail.type,
          '\n', 'response', response,
        );

        window.dispatchEvent(createShowdexEvent('response', {
          type: 'clipboardReadText',
          payload: response,
        }));
      } catch (error) {
        if (__DEV__) {
          l.error(
            'Failed to handle message event', `${e.type || '(missing event.type)'}:`,
            '\n', error,
            '\n', 'event', e,
            '\n', '(You will only see this error on development.)',
          );
        }
      }
    })();
  });
}
