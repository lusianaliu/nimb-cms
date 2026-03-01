const renderNavigation = (navigation, htmlEscape) => {
  const items = (navigation ?? [])
    .map((item) => `<a href="${htmlEscape(item?.url ?? '#')}">${htmlEscape(item?.label ?? '')}</a>`)
    .join('');

  return `<nav>${items}</nav>`;
};

export const renderLayout = (context, body) => {
  const escape = context?.htmlEscape ?? ((value) => `${value ?? ''}`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escape(context?.site?.name ?? 'My Nimb Site')}</title>
  </head>
  <body>
    <header>
      <h1>${escape(context?.site?.name ?? 'My Nimb Site')}</h1>
      <p>${escape(context?.site?.description ?? '')}</p>
      ${renderNavigation(context?.navigation, escape)}
    </header>
    <main>${body}</main>
  </body>
</html>`;
};
