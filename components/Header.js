import { getSession } from "../lib/auth";
import HeaderClient from "./HeaderClient";

export default async function Header({ activePage }) {
  const session = await getSession();
  const user = session
    ? { id: session.sub, name: session.name, email: session.email }
    : null;
  return <HeaderClient activePage={activePage} user={user} />;
}
