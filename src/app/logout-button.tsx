import { signOut } from "@/auth";

export function LogoutButton() {
  return (
    <form
      className="logout-form"
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button className="logout-button" type="submit">
        Abmelden
      </button>
    </form>
  );
}
