/**
 * Admin pages use the system cursor: the site's custom cursor gets in the way
 * of text fields, drag handles and resize targets. `data-native-cursor` turns
 * off the global `cursor: none` rule (see globals.css); `display: contents`
 * keeps the wrapper out of the layout.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-native-cursor className="contents">
      {children}
    </div>
  );
}
