
import ProductCatalog from "./components/ProductCatalog";
import Login from "./components/Login";
import ManagerDashboard from "./components/ManagerDashboard";
import StudentDashboard from "./components/StudentDashboard";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
    return (
        <BrowserRouter>
            <Routes>

                
                <Route path="/login" element={<Login />} />

                
                <Route path="/ProductCatalog" element={<ProductCatalog />} />
                <Route path="/student-dashboard" element={<StudentDashboard />} />

                <Route path="/staff-dashboard" element={<ProductCatalog />} />

                <Route
                    path="/manager-dashboard"
                    element={<ManagerDashboard />}
                />

                
                <Route
                    path="/"
                    element={<Navigate to="/login" replace />}
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;
