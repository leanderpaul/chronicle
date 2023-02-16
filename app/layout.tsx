/**
 * Importing npm packages.
 */

/**
 * Importing npm design components.
 */

/**
 * Importing user defined components.
 */

/**
 *  Importing user defined modules.
 */

/**
 * Importing styled components.
 */

/**
 * Importing types.
 */
interface ILayoutProps {
  children: React.ReactNode;
}

function Layout(props: ILayoutProps) {
  return (
    <html lang='en'>
      <head />
      <body>{props.children}</body>
    </html>
  );
}

export default Layout;
