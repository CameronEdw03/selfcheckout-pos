
import ProductCatalog from "./components/ProductCatalog";
import Login from "./components/Login";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function App() {
    return (
        <BrowserRouter>
            <Routes>

                
                <Route path="/login" element={<Login />} />

                
                <Route path="/ProductCatalog" element={<ProductCatalog />} />

                
                <Route
                    path="/"
                    element={<Navigate to="/login" replace />}
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;

