/**
 * Importing npm packages.
 */

/**
 * Importing npm design components.
 */
// import { Context } from '@server/utils/constants';

/**
 * Importing user defined components.
 */

/**
 *  Importing user defined modules.
 */

/**
 * Importing styled components.
 */
import './global.css';

/**
 * Importing types.
 */
interface ILayoutProps {
  children: React.ReactNode;
}

async function Layout(props: ILayoutProps) {
  return (
    <html lang='en'>
      <head />
      <body>{props.children}</body>
    </html>
  );
}

export default Layout;
