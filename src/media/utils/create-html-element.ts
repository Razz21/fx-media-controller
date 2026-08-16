export interface CreateElementOptions<K extends keyof HTMLElementTagNameMap> {
  className?: string;
  attrs?: Record<string, string>;
  props?: Partial<HTMLElementTagNameMap[K]>;
}

export function createElementFactory(doc: ChromeDocument) {
  return function createHTMLElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options?: string | CreateElementOptions<K>,
  ): HTMLElementTagNameMap[K] {
    const el = doc.createElementNS(
      'http://www.w3.org/1999/xhtml',
      tag,
    ) as HTMLElementTagNameMap[K];

    const opts = typeof options === 'string' ? { className: options } : options;

    if (opts?.className) el.className = opts.className;
    if (opts?.attrs) {
      for (const [key, value] of Object.entries(opts.attrs)) {
        el.setAttribute(key, value);
      }
    }
    if (opts?.props) Object.assign(el, opts.props);

    return el;
  };
}
