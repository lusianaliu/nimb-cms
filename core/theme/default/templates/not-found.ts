export const renderNotFoundTemplate = (context) => {
  const escape = context?.htmlEscape ?? ((value) => `${value ?? ''}`);

  return `<section><h2>404</h2><p>Page not found: ${escape(context?.route?.path ?? '')}</p></section>`;
};
