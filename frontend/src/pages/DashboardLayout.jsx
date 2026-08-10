import { Outlet } from "react-router-dom";

function DashboardLayout() {
  console.log('DashboardLayout render');

  return (
    <div className="dashboard-layout" style={{ padding: "20px" }}>
      {/* Render matched protected child route here. */}
      <div>
        <Outlet />
      </div>
    </div>
  );
}

export default DashboardLayout;