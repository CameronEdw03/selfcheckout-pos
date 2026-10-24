
import { useEffect, useMemo, useState } from "react";

const API = "http://127.0.0.1:8000";

function courseId(course) {
  return String(course?.course_id ?? course?.id ?? "");
}

function courseLabel(course) {
  const number = course?.course_number ?? course?.course_code ?? course?.number ?? "";
  const name = course?.course_name ?? course?.name ?? course?.title ?? "";
  return [number, name].filter(Boolean).join(" — ") || `Course ${courseId(course)}`;
}

function productId(product) {
  return String(product?.product_id ?? product?.id ?? "");
}

async function readResponse(response) {
  const body = await response.text();

  if (!response.ok) {
    let message = body || `Request failed (${response.status})`;

    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || parsed.message || message;
    } catch {
      // Keep the original response body if it isn't JSON.
    }

    throw new Error(message);
  }

  return body ? JSON.parse(body) : null;
}

/**
 * Manager-only panel for linking catalog products to courses.
 * Render this component inside your Manager Dashboard.
 */
export default function CourseProductAssignment() {
  const [courses, setCourses] = useState([]);
  const [products, setProducts] = useState([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [managerPassword, setManagerPassword] = useState("");
  const [required, setRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Read the manager account saved by your login page.
  const manager = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [courseResponse, productResponse] = await Promise.all([
        fetch(`${API}/courses`),
        fetch(`${API}/products`),
      ]);

      const [courseData, productData] = await Promise.all([
        readResponse(courseResponse),
        readResponse(productResponse),
      ]);

      if (!Array.isArray(courseData) || !Array.isArray(productData)) {
        throw new Error("The API did not return courses and products as lists.");
      }

      setCourses(courseData);
      setProducts(productData);
    } catch (err) {
      setError(err.message || "Unable to load courses and products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const matchingCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();

    return courses.filter((course) =>
      courseLabel(course).toLowerCase().includes(query)
    );
  }, [courses, courseSearch]);

  const selectedCourse = courses.find(
    (course) => courseId(course) === selectedCourseId
  );

  const assignedProducts = selectedCourse?.products || [];
  const assignedIds = new Set(assignedProducts.map(productId));

  const matchingProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();

    return products.filter((product) => {
      const label =
        `${product.name ?? ""} ${product.category ?? ""} ${product.product_id ?? ""}`
          .toLowerCase();

      return label.includes(query) && !assignedIds.has(productId(product));
    });
  }, [products, productSearch, selectedCourse]);

  async function assignProduct() {
    if (!selectedCourseId || !selectedProductId) {
      setError("Choose a course and product first.");
      return;
    }

    const managerUsername = manager?.username ?? manager?.user_name;

    if (!managerUsername) {
      setError("Could not find the manager username in the saved login.");
      return;
    }

    if (!managerPassword.trim()) {
      setError("Enter your manager password to authorize this change.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/courses/${encodeURIComponent(selectedCourseId)}/products/${encodeURIComponent(selectedProductId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: managerUsername,
            password: managerPassword,
            required,
          }),
        }
      );

      const data = await readResponse(response);

      setNotice(data?.message || "Product assigned.");
      setSelectedProductId("");
      setProductSearch("");

      await loadData();
    } catch (err) {
      setError(err.message || "Could not assign product.");
    } finally {
      setSaving(false);
    }
  }

  async function unassignProduct(product) {
    if (!selectedCourseId) return;

    const managerUsername = manager?.username ?? manager?.user_name;

    if (!managerUsername) {
      setError("Could not find the manager username in the saved login.");
      return;
    }

    if (!managerPassword.trim()) {
      setError("Enter your manager password to authorize this change.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/courses/${encodeURIComponent(selectedCourseId)}/products/${encodeURIComponent(productId(product))}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: managerUsername,
            password: managerPassword,
          }),
        }
      );

      const data = await readResponse(response);

      setNotice(data?.message || "Product removed from course.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not remove product assignment.");
    } finally {
      setSaving(false);
    }
  }

  // Prevent non-manager accounts from using this panel.
  if (manager?.role !== "manager") {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Only a manager account can access course-product assignments.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-700">
          Catalog administration
        </p>

        <h2 className="mt-1 text-2xl font-black text-slate-900">
          Assign products to courses
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Link existing inventory items to a course. This changes the course
          assignment, not product stock.
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {loading ? (
        <p className="py-8 text-sm text-slate-500">
          Loading courses and products…
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left side: choose a course and view its assigned products */}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Find course
              </span>

              <input
                value={courseSearch}
                onChange={(event) => setCourseSearch(event.target.value)}
                placeholder="Search course number or name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Select course
              </span>

              <select
                value={selectedCourseId}
                onChange={(event) => setSelectedCourseId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
              >
                <option value="">Choose a course…</option>

                {matchingCourses.map((course) => (
                  <option key={courseId(course)} value={courseId(course)}>
                    {courseLabel(course)}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-bold text-slate-800">
                Currently assigned
              </h3>

              {!selectedCourse ? (
                <p className="mt-2 text-sm text-slate-500">
                  Choose a course to view its assigned products.
                </p>
              ) : assignedProducts.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No products are assigned to this course yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-200">
                  {assignedProducts.map((product) => (
                    <li
                      key={productId(product)}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {product.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          ID {productId(product)} · {product.category ?? "Uncategorized"}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => unassignProduct(product)}
                        className="shrink-0 rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right side: choose a product to assign to the selected course */}
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Find unassigned product
              </span>

              <input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search product name, category, or ID"
                disabled={!selectedCourse}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Select product
              </span>

              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={!selectedCourse}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 disabled:bg-slate-100"
              >
                <option value="">Choose a product…</option>

                {matchingProducts.map((product) => (
                  <option key={productId(product)} value={productId(product)}>
                    {product.name} (ID {productId(product)})
                  </option>
                ))}
              </select>

              {selectedCourse && matchingProducts.length === 0 && (
                <span className="mt-1 block text-xs text-slate-500">
                  No matching unassigned products.
                </span>
              )}
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={required}
                onChange={(event) => setRequired(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Mark as required for this course
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">
                Manager password (authorization)
              </span>

              <input
                type="password"
                autoComplete="current-password"
                value={managerPassword}
                onChange={(event) => setManagerPassword(event.target.value)}
                placeholder="Enter manager password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <button
              type="button"
              disabled={
                saving ||
                !selectedCourse ||
                !selectedProductId ||
                !managerPassword.trim()
              }
              onClick={assignProduct}
              className="w-full rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving assignment…" : "Assign product to course"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
