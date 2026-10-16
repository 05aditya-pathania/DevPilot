function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { label: "Dashboard", value: "dashboard" },
    { label: "Projects", value: "projects" },
    { label: "Debug Sessions", value: "debug-sessions" },
    { label: "History", value: "history" },
    { label: "Settings", value: "settings" },
  ];

  return (
    <aside className="sidebar">
      <h2 className="brand">
        Dev<span>Pilot</span>
      </h2>

      <nav>
        {menuItems.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`nav-item ${
              activePage === item.value ? "active" : ""
            }`}
            onClick={() => setActivePage(item.value)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;