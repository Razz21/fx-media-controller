export function createIconButton(
  doc: ChromeDocument,
  className: string,
  svgContent: string,
  ariaLabel: string,
): { button: XULElement; svg: SVGElement } {
  const btn = doc.createXULElement('toolbarbutton') as XULElement;
  btn.className = className;
  btn.setAttribute('type', 'button');
  btn.setAttribute('tabindex', '-1');
  btn.setAttribute('aria-label', ariaLabel);
  btn.setAttribute('label', '');

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.innerHTML = svgContent;

  btn.appendChild(svg);

  btn.addEventListener('mousedown', (e) => e.stopPropagation());

  return { button: btn, svg };
}
