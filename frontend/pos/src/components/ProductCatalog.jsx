import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const API = "http://127.0.0.1:8000";

function getProductId(item) {
  return Number(item?.product_id ?? item?.id);
}

// Convert the rows returned by /products/with-colors into one product per card.
// The endpoint may return one row per product/color pair or products with a
// nested colors array; this handles both response shapes.
function groupProductsWithColors(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const product = row?.product ?? row;
    const productId = getProductId(product);

    if (!Number.isFinite(productId)) continue;

    if (!grouped.has(productId)) {
      grouped.set(productId, {
        ...product,
        product_id: productId,
        colors: Array.isArray(product.colors) ? [...product.colors] : [],
      });
    }

    const existing = grouped.get(productId);
    const rowColor =
      row?.color ??
      (row?.color_id != null || row?.color_name
        ? {
            color_id: row.color_id,
            color_name: row.color_name ?? row.name_color ?? row.color,
            hex_code: row.hex_code ?? row.color_hex ?? row.color_code,
          }
        : null);

    if (rowColor && (rowColor.color_id != null || rowColor.color_name)) {
      const alreadyAdded = existing.colors.some(
        (color) =>
          String(color.color_id ?? color.id ?? color.color_name) ===
          String(rowColor.color_id ?? rowColor.id ?? rowColor.color_name)
      );

      if (!alreadyAdded) existing.colors.push(rowColor);
    }

    if (Array.isArray(row?.colors)) {
      for (const color of row.colors) {
        const alreadyAdded = existing.colors.some(
          (item) =>
            String(item.color_id ?? item.id ?? item.color_name) ===
            String(color.color_id ?? color.id ?? color.color_name)
        );
        if (!alreadyAdded) existing.colors.push(color);
      }
    }
  }

  return [...grouped.values()];
}

function getColorId(color) {
  return color?.color_id ?? color?.id ?? color?.colorId ?? "";
}

function getColorName(color) {
  return color?.color_name ?? color?.name ?? color?.color ?? "Color";
}

function getColorHex(color) {
  const value = color?.hex_code ?? color?.hex ?? color?.color_code;
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value)
    ? value
    : "#94A3B8";
}

// Convert the rows returned by /products/with-sizes into a map of
// product_id -> sizes array (already ordered S, M, L, XL, XXL by the backend).
function groupSizesByProduct(rows) {
  const grouped = new Map();

  for (const row of rows) {
    const productId = getProductId(row);

    if (!Number.isFinite(productId) || row?.size_id == null) continue;

    if (!grouped.has(productId)) grouped.set(productId, []);

    const sizes = grouped.get(productId);
    if (!sizes.some((size) => size.size_id === row.size_id)) {
      sizes.push({ size_id: row.size_id, size_name: row.size_name });
    }
  }

  return grouped;
}

function getSizeId(size) {
  return size?.size_id ?? size?.id ?? "";
}

function getSizeName(size) {
  return size?.size_name ?? size?.name ?? "Size";
}

function normalizeCartResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.cart)) return data.cart;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function getProductPrice(product) {
  return Number(product?.discounted_price ?? product?.price ?? 0);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

const PAYMENT_LABELS = {
  cash: "Cash",
  card: "Card",
  voucher: "Student Voucher",
};

function getCourseLabel(course) {
  const code =
    course?.course_code ??
    course?.course_number ??
    course?.code ??
    course?.number ??
    "";

  const name =
    course?.course_name ??
    course?.name ??
    course?.title ??
    course?.description ??
    "";

  if (code && name && String(name) !== String(code)) {
    return `${code} — ${name}`;
  }

  return String(
    code || name || `Course ${course?.course_id ?? course?.id ?? ""}`
  );
}

function getCourseId(course) {
  return String(course?.course_id ?? course?.id ?? "");
}

function getBundleId(bundle) {
  return String(bundle?.bundle_id ?? bundle?.id ?? "");
}

async function readResponse(response) {
  const text = await response.text();

  if (!response.ok) {
    let message = text || `Request failed (${response.status})`;

    try {
      const parsed = JSON.parse(text);
      message = parsed.detail || parsed.message || message;
    } catch {
      // Keep the response text.
    }

    throw new Error(message);
  }

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function ProductCatalog() {
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [selectedColors, setSelectedColors] = useState({});
  const [sizePickerProduct, setSizePickerProduct] = useState(null);
  const [pendingSizeId, setPendingSizeId] = useState("");
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [bundles, setBundles] = useState([]);
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [priceDiscountProduct, setPriceDiscountProduct] = useState(null);
  const [priceDiscountForm, setPriceDiscountForm] = useState({
    new_price: "",
    reason: "",
    password: "",
  });
  const [savingPriceDiscount, setSavingPriceDiscount] = useState(false);
  const [priceDiscountError, setPriceDiscountError] = useState("");
  const [priceDiscountSuccess, setPriceDiscountSuccess] = useState("");
  const [priceHistory, setPriceHistory] = useState(null);
  const [priceHistoryPassword, setPriceHistoryPassword] = useState("");
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState("");
  const [staffStudentId, setStaffStudentId] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffTransaction, setStaffTransaction] = useState(null);
  const [staffTransactionLoading, setStaffTransactionLoading] = useState(false);
  const [staffTransactionError, setStaffTransactionError] = useState("");
  const [staffTransactionMessage, setStaffTransactionMessage] = useState("");
  const [staffDiscountDrafts, setStaffDiscountDrafts] = useState({});
  const [staffBusyItemId, setStaffBusyItemId] = useState(null);

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState("");
  const [loadingBundles, setLoadingBundles] = useState(true);
  const [bundleError, setBundleError] = useState("");
  const [loadingCart, setLoadingCart] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [error, setError] = useState("");
  const [cartError, setCartError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived] = useState("");
  const [studentId, setStudentId] = useState("");
  const [receiptPhone, setReceiptPhone] = useState("");

  const [receipt, setReceipt] = useState(null);

  // Check the logged-in user.
  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (!savedUser) {
      navigate("/login");
      return;
    }

    try {
      const user = JSON.parse(savedUser);

      if (!user?.user_id) {
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      if (user.role === "manager") {
        navigate("/manager-dashboard");
        return;
      }

      if (user.role === "employee" && location.pathname !== "/staff-dashboard") {
        navigate("/staff-dashboard", { replace: true });
        return;
      }

      if (user.role !== "employee" && location.pathname === "/staff-dashboard") {
        navigate("/ProductCatalog", { replace: true });
        return;
      }

      setCurrentUser(user);
    } catch {
      localStorage.removeItem("user");
      navigate("/login");
    }
  }, [location.pathname, navigate]);

  // Load all store products and their available colors.
  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setLoadingProducts(true);
        setError("");

        // Load the regular catalog first so products without assigned colors
        // still appear in the store.
        const productResponse = await fetch(`${API}/products`);
        const baseProducts = await readResponse(productResponse);

        if (!Array.isArray(baseProducts)) {
          throw new Error("The products endpoint did not return a product list.");
        }

        let productsWithColors = [];
        try {
          const colorResponse = await fetch(`${API}/products/with-colors`);
          const colorRows = await readResponse(colorResponse);

          if (Array.isArray(colorRows)) {
            productsWithColors = groupProductsWithColors(colorRows);
          }
        } catch {
          // Keep the regular product catalog available if colors cannot load.
        }

        let sizesByProduct = new Map();
        try {
          const sizeResponse = await fetch(`${API}/products/with-sizes`);
          const sizeRows = await readResponse(sizeResponse);

          if (Array.isArray(sizeRows)) {
            sizesByProduct = groupSizesByProduct(sizeRows);
          }
        } catch {
          // Keep the regular product catalog available if sizes cannot load.
        }

        const productsById = new Map(
          productsWithColors.map((product) => [getProductId(product), product])
        );

        const mergedProducts = baseProducts.map((product) => {
          const colorProduct = productsById.get(getProductId(product));

          return {
            ...product,
            colors: colorProduct?.colors ?? product.colors ?? [],
            sizes: sizesByProduct.get(getProductId(product)) ?? product.sizes ?? [],
          };
        });

        if (!cancelled) {
          setProducts(mergedProducts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load products.");
        }
      } finally {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBundles() {
      try {
        setLoadingBundles(true);
        setBundleError("");

        const response = await fetch(`${API}/bundles`);
        const data = await readResponse(response);

        if (!Array.isArray(data)) {
          throw new Error("The bundles endpoint did not return a bundle list.");
        }

        if (!cancelled) {
          setBundles(data);
        }
      } catch (err) {
        if (!cancelled) {
          setBundleError(err.message || "Unable to load supply bundles.");
        }
      } finally {
        if (!cancelled) {
          setLoadingBundles(false);
        }
      }
    }

    loadBundles();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load courses. The GET /courses endpoint should return each course
  // with a products array containing its assigned products.
  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      try {
        setLoadingCourses(true);
        setCourseError("");

        const response = await fetch(`${API}/courses`);
        const data = await readResponse(response);

        if (!Array.isArray(data)) {
          throw new Error(
            "The courses endpoint did not return a course list."
          );
        }

        if (!cancelled) {
          setCourses(data);
        }
      } catch (err) {
        if (!cancelled) {
          setCourseError(
            err.message ||
              "Unable to load courses. You can still browse all products."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCourses(false);
        }
      }
    }

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  // Retrieve the current user's cart from FastAPI.
  const refreshCart = useCallback(async () => {
    if (!currentUser?.user_id) {
      setCartItems([]);
      return [];
    }

    setLoadingCart(true);
    setCartError("");

    try {
      const response = await fetch(`${API}/cart/${currentUser.user_id}`);
      const data = await readResponse(response);
      const normalizedItems = normalizeCartResponse(data);

      setCartItems(normalizedItems);
      return normalizedItems;
    } catch (err) {
      setCartError(err.message || "Unable to load your cart.");
      throw err;
    } finally {
      setLoadingCart(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.user_id) {
      refreshCart().catch(() => {});
    }
  }, [currentUser, refreshCart]);

  // Create the available category buttons from the product catalog.
  const categories = useMemo(() => {
    const uniqueCategories = [
      ...new Set(products.map((product) => product.category).filter(Boolean)),
    ];

    return ["All", ...uniqueCategories];
  }, [products]);

  // Find the selected course object.
  const selectedCourse = useMemo(
    () => courses.find((course) => getCourseId(course) === selectedCourseId),
    [courses, selectedCourseId]
  );

  const selectedBundle = useMemo(
    () => bundles.find((bundle) => getBundleId(bundle) === selectedBundleId),
    [bundles, selectedBundleId]
  );

  // When a course or bundle is selected, browse only its assigned products.
  const filteredProducts = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const selectedGroup = selectedCourse ?? selectedBundle;
    const productsToBrowse = selectedGroup
      ? Array.isArray(selectedGroup.products)
        ? selectedGroup.products
        : []
      : products;

    return productsToBrowse
      .map((product) => {
        const fullProduct = products.find(
          (item) => getProductId(item) === getProductId(product)
        );

        return {
          ...(fullProduct ?? {}),
          ...product,
          product_id: getProductId(product),
          colors:
            Array.isArray(product.colors) && product.colors.length > 0
              ? product.colors
              : fullProduct?.colors ?? [],
          sizes:
            Array.isArray(product.sizes) && product.sizes.length > 0
              ? product.sizes
              : fullProduct?.sizes ?? [],
        };
      })
      .filter((product) => {
        const matchesCategory =
          category === "All" || product.category === category;

        const matchesSearch =
          String(product.name ?? "").toLowerCase().includes(searchValue) ||
          String(product.description ?? "").toLowerCase().includes(searchValue) ||
          String(product.category ?? "").toLowerCase().includes(searchValue);

        return matchesCategory && matchesSearch;
      });
  }, [products, selectedCourse, selectedBundle, category, search]);

  // Combine cart data with catalog data so cart lines have product names,
  // categories, prices, quantities, and totals.
  const cartLines = useMemo(() => {
    return cartItems.map((cartItem) => {
      const productId = getProductId(cartItem);

      const catalogProduct = products.find(
        (product) => getProductId(product) === productId
      );

      const product = {
        ...(catalogProduct ?? {}),
        ...cartItem,
        product_id: productId,
        name: cartItem.name ?? catalogProduct?.name ?? `Product ${productId}`,
        category: cartItem.category ?? catalogProduct?.category ?? "",
        description:
          cartItem.description ?? catalogProduct?.description ?? "",
        price: cartItem.price ?? catalogProduct?.price ?? 0,
      };

      const quantity = Math.max(1, Number(cartItem.quantity ?? 1));
      const unitPrice = getProductPrice(product);

      const lineTotal =
        cartItem.line_total != null
          ? Number(cartItem.line_total)
          : unitPrice * quantity;

      return {
        ...product,
        quantity,
        unitPrice,
        lineTotal,
      };
    });
  }, [cartItems, products]);

  const cartCount = cartLines.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const cartTotal = cartLines.reduce(
    (total, item) => total + item.lineTotal,
    0
  );

  // Add a product to the cart.
  async function addToCart(product) {
    if (!currentUser?.user_id) {
      navigate("/login");
      return;
    }

    if (loadingCart) return;

    setCartError("");

    try {
      const url = new URL(`${API}/cart`);
      url.searchParams.set("user_id", String(currentUser.user_id));
      url.searchParams.set("product_id", String(product.product_id));

      // The current cart API accepts only user_id and product_id. The
      // selected color and size are shown in the catalog, but are not
      // persisted in the cart until the cart/order schema supports them.
      const response = await fetch(url.toString(), {
        method: "POST",
      });

      await readResponse(response);
      await refreshCart();
    } catch (err) {
      setCartError(err.message || "Unable to add this product to your cart.");
    }
  }

  // Add all available products from a selected course to the cart.
  async function addCourseBundleToCart() {
    if (!currentUser?.user_id) {
      navigate("/login");
      return;
    }

    if (!selectedCourseId || loadingCart) return;

    setCartError("");

    try {
      const response = await fetch(
        `${API}/cart/${currentUser.user_id}/courses/${selectedCourseId}`,
        { method: "POST" }
      );

      const data = await readResponse(response);

      if (data?.success === false) {
        throw new Error(data.message || "Unable to add course bundle.");
      }

      await refreshCart();

      if (data?.unavailable?.length > 0) {
        setCartError(
          `Unavailable products: ${data.unavailable.join(", ")}`
        );
      }
    } catch (err) {
      setCartError(err.message || "Unable to add course bundle.");
    }
  }

  async function refreshStaffTransaction(studentId, password = staffPassword) {
    if (!currentUser?.username) {
      throw new Error("You must be signed in as an employee.");
    }

    const response = await fetch(
      `${API}/staff/transactions/${encodeURIComponent(studentId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_name: currentUser.username,
          password,
        }),
      }
    );
    const data = await readResponse(response);

    if (!data || !Array.isArray(data.cart)) {
      throw new Error("The student transaction response was invalid.");
    }

    setStaffTransaction(data);
    return data;
  }

  async function loadStaffTransaction(event) {
    event.preventDefault();
    setStaffTransactionLoading(true);
    setStaffTransactionError("");
    setStaffTransactionMessage("");
    setStaffTransaction(null);

    try {
      const studentId = staffStudentId.trim();
      if (!studentId) {
        throw new Error("Enter a student ID.");
      }

      await refreshStaffTransaction(studentId);
      setStaffStudentId(studentId);
    } catch (err) {
      setStaffTransactionError(
        err.message || "Unable to load the student transaction."
      );
    } finally {
      setStaffTransactionLoading(false);
    }
  }

  async function removeStaffTransactionItem(productId) {
    if (!staffTransaction) return;

    setStaffBusyItemId(productId);
    setStaffTransactionError("");
    setStaffTransactionMessage("");

    try {
      const response = await fetch(
        `${API}/staff/transactions/${encodeURIComponent(
          staffTransaction.student_id
        )}/items/${productId}/remove`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: currentUser.username,
            password: staffPassword,
          }),
        }
      );
      await readResponse(response);
      await refreshStaffTransaction(staffTransaction.student_id);
      setStaffTransactionMessage("Product removed from the student transaction.");
    } catch (err) {
      setStaffTransactionError(
        err.message || "Unable to remove the product from this transaction."
      );
    } finally {
      setStaffBusyItemId(null);
    }
  }

  async function applyStaffTransactionDiscount(event, item) {
    event.preventDefault();
    if (!staffTransaction) return;

    const draft = staffDiscountDrafts[item.product_id] ?? {};
    setStaffBusyItemId(item.product_id);
    setStaffTransactionError("");
    setStaffTransactionMessage("");

    try {
      const response = await fetch(
        `${API}/staff/transactions/${encodeURIComponent(
          staffTransaction.student_id
        )}/items/${item.product_id}/discount`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: currentUser.username,
            password: staffPassword,
            new_price: Number(draft.new_price),
            reason: (draft.reason ?? "").trim(),
          }),
        }
      );
      const data = await readResponse(response);
      await refreshStaffTransaction(staffTransaction.student_id);
      setStaffDiscountDrafts((drafts) => ({
        ...drafts,
        [item.product_id]: { new_price: "", reason: "" },
      }));
      setStaffTransactionMessage(
        `${item.name}: price reduced from $${formatMoney(
          data.previous_price
        )} to $${formatMoney(data.new_price)}.`
      );
    } catch (err) {
      setStaffTransactionError(
        err.message || "Unable to apply the transaction discount."
      );
    } finally {
      setStaffBusyItemId(null);
    }
  }

  async function cancelStaffTransaction() {
    if (!staffTransaction) return;
    if (
      !window.confirm(
        `Cancel the in-progress transaction for ${staffTransaction.student_id}? This removes all items from their cart.`
      )
    ) {
      return;
    }

    setStaffTransactionLoading(true);
    setStaffTransactionError("");
    setStaffTransactionMessage("");

    try {
      const response = await fetch(
        `${API}/staff/transactions/${encodeURIComponent(
          staffTransaction.student_id
        )}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_name: currentUser.username,
            password: staffPassword,
          }),
        }
      );
      await readResponse(response);
      setStaffTransaction((transaction) => ({
        ...transaction,
        cart: [],
        total: "0.00",
      }));
      setStaffTransactionMessage("The student transaction was canceled.");
    } catch (err) {
      setStaffTransactionError(
        err.message || "Unable to cancel the student transaction."
      );
    } finally {
      setStaffTransactionLoading(false);
    }
  }
    


  // Remove one product from the cart.
  async function submitPriceDiscount(event) {
    event.preventDefault();

    if (!priceDiscountProduct || !currentUser) return;

    setSavingPriceDiscount(true);
    setPriceDiscountError("");
    setPriceDiscountSuccess("");

    try {
      const response = await fetch(
        `${API}/products/${getProductId(priceDiscountProduct)}/price-discount`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_name: currentUser.username,
            password: priceDiscountForm.password,
            new_price: Number(priceDiscountForm.new_price),
            reason: priceDiscountForm.reason.trim(),
          }),
        }
      );

      const data = await readResponse(response);

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          getProductId(product) === getProductId(priceDiscountProduct)
            ? {
                ...product,
                price: data.new_price,
                discount_percent: 0,
              }
            : product
        )
      );
      setPriceDiscountSuccess(
        `${priceDiscountProduct.name} price updated from $${formatMoney(
          data.old_price
        )} to $${formatMoney(data.new_price)}.`
      );
      setPriceDiscountProduct(null);
      setPriceDiscountForm({ new_price: "", reason: "", password: "" });
    } catch (err) {
      setPriceDiscountError(
        err.message || "Unable to update the product price."
      );
    } finally {
      setSavingPriceDiscount(false);
    }
  }

  function openPriceDiscount(product) {
    setPriceDiscountProduct(product);
    setPriceDiscountForm({ new_price: "", reason: "", password: "" });
    setPriceDiscountError("");
    setPriceDiscountSuccess("");
  }

  async function loadPriceHistory(event) {
    event.preventDefault();
    if (!currentUser) return;

    setLoadingPriceHistory(true);
    setPriceHistoryError("");

    try {
      const response = await fetch(`${API}/products/price-history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_name: currentUser.username,
          password: priceHistoryPassword,
        }),
      });

      const data = await readResponse(response);

      if (!Array.isArray(data)) {
        throw new Error("The product price history response was invalid.");
      }

      setPriceHistory(data);
      setPriceHistoryPassword("");
    } catch (err) {
      setPriceHistoryError(
        err.message || "Unable to load product price history."
      );
    } finally {
      setLoadingPriceHistory(false);
    }
  }

  async function removeFromCart(productId) {
    if (!currentUser?.user_id) return;

    setCartError("");

    try {
      const response = await fetch(
        `${API}/cart/${currentUser.user_id}/${productId}`,
        { method: "DELETE" }
      );

      await readResponse(response);
      await refreshCart();
    } catch (err) {
      setCartError(err.message || "Unable to remove this item.");
    }
  }

  // Update a cart item's quantity.
  async function updateQuantity(productId, quantity) {
    if (!currentUser?.user_id) return;

    const nextQuantity = Number(quantity);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 1) {
      await removeFromCart(productId);
      return;
    }

    setCartError("");

    try {
      const response = await fetch(
        `${API}/cart/${currentUser.user_id}/${productId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quantity: nextQuantity }),
        }
      );

      await readResponse(response);
      await refreshCart();
    } catch (err) {
      setCartError(err.message || "Unable to update item quantity.");
    }
  }

  // Clear the cart.
  async function removeAllFromCart() {
    if (!currentUser?.user_id) return;

    setCartError("");

    try {
      const response = await fetch(`${API}/cart/${currentUser.user_id}`, {
        method: "DELETE",
      });

      await readResponse(response);
      await refreshCart();
    } catch (err) {
      setCartError(err.message || "Unable to clear your cart.");
    }
  }

  function openCheckout() {
    setCheckoutError("");
    setCashReceived("");
    setStudentId("");
    setPaymentMethod("cash");
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  }

  // Submit checkout to the FastAPI backend.
  async function completeCheckout(event) {
    event.preventDefault();

    if (!currentUser?.user_id || cartLines.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");

    const receiptItems = cartLines.map((item) => ({
      product_id: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    }));

    const enteredStudentId = studentId.trim();

    // Send student_id only when the shopper entered one.
    const checkoutBody =
      enteredStudentId.length > 0
        ? { student_id: enteredStudentId }
        : {};

    try {
      let response;

      if (paymentMethod === "cash") {
        if (cashReceived.trim() === "") {
          throw new Error("Enter the amount of cash received.");
        }

        const amountReceived = Number(cashReceived);

        if (!Number.isFinite(amountReceived) || amountReceived < 0) {
          throw new Error("Enter a valid cash amount.");
        }

        response = await fetch(
          `${API}/checkout/${currentUser.user_id}/cash`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...checkoutBody,
              cash_received: amountReceived.toFixed(2),
            }),
          }
        );
      } else if (paymentMethod === "voucher") {
        if (!enteredStudentId) {
          throw new Error("Enter your student ID to pay with your voucher.");
        }

        response = await fetch(
          `${API}/checkout/${currentUser.user_id}/voucher`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              student_id: enteredStudentId,
            }),
          }
        );
      } else {
        response = await fetch(
          `${API}/checkout/${currentUser.user_id}/card`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...checkoutBody,
              approved: true,
            }),
          }
        );
      }

      const paymentResponse = await readResponse(response);

      setReceipt({
        receiptId: paymentResponse?.receipt_id ?? "",
        date: new Date().toLocaleString(),
        items: receiptItems,
        subtotal: Number(paymentResponse?.subtotal ?? cartTotal),
        studentDiscount: Number(paymentResponse?.student_discount ?? 0),
        studentDiscountApplied: Boolean(
          paymentResponse?.student_discount_applied
        ),
        total: Number(paymentResponse?.total ?? cartTotal),
        paymentMethod,
        cashReceived:
          paymentResponse?.cash_received ??
          (paymentMethod === "cash" ? cashReceived : ""),
        change: paymentResponse?.change ?? null,
        voucherBalance: paymentResponse?.voucher_balance ?? null,
        message:
          paymentResponse?.message ?? "Checkout completed successfully.",
      });

      await refreshCart();

      setIsCheckoutOpen(false);
      setIsReceiptOpen(true);
    } catch (err) {
      setCheckoutError(err.message || "Checkout failed. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Prepare an SMS message with the receipt.
  function textReceipt() {
    const phone = receiptPhone.trim();

    if (!phone) {
      setCheckoutError("Enter a phone number to prepare the receipt text.");
      return;
    }

    if (!receipt) return;

    const receiptText = [
      "Dallas College Self-Checkout Receipt",
      receipt.receiptId ? `Receipt: ${receipt.receiptId}` : "",
      `Date: ${receipt.date}`,
      ...receipt.items.map(
        (item) =>
          `${item.name} x${item.quantity} - $${formatMoney(item.line_total)}`
      ),
      `Subtotal: $${formatMoney(receipt.subtotal)}`,
      receipt.studentDiscountApplied
        ? `Student discount: -$${formatMoney(receipt.studentDiscount)}`
        : "",
      `Total: $${formatMoney(receipt.total)}`,
      `Payment: ${PAYMENT_LABELS[receipt.paymentMethod]}`,
      receipt.voucherBalance != null
        ? `Voucher balance remaining: $${formatMoney(receipt.voucherBalance)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const smsUrl = `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(
      receiptText
    )}`;

    window.location.href = smsUrl;
  }

  function handleLogout() {
    localStorage.removeItem("user");
    setCurrentUser(null);
    setCartItems([]);
    navigate("/login");
  }

  if (loadingProducts) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-900 border-t-transparent" />
          <p className="font-semibold text-slate-700">
            Loading self-checkout...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <h2 className="text-xl font-bold text-slate-900">
            Unable to load products
          </h2>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-6 rounded-lg bg-blue-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b-4 border-red-600 bg-white shadow-sm">
        <div className="mx-auto max-w-[1600px] px-6 py-4 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-900">
                <span className="text-lg font-black text-white">DC</span>
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-blue-950">
                  Dallas College
                </h1>
                <p className="text-sm font-semibold text-slate-500">
                  Library Self-Checkout
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="w-full sm:w-80">
                <input
                  type="text"
                  placeholder="Search the library store"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:bg-white"
                />
              </div>

              {currentUser && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {currentUser.role === "employee" ? "Employee" : "Customer"}
                  </p>
                  <p className="text-sm font-bold text-blue-950">
                    {currentUser.username}
                  </p>
                  {currentUser.role === "student" && (
                    <button
                      type="button"
                      onClick={() => navigate("/student-dashboard")}
                      className="mt-1 text-xs font-bold text-blue-800 underline hover:text-blue-950"
                    >
                      Student dashboard
                    </button>
                  )}
                </div>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsCartOpen((open) => !open);
                    if (!isCartOpen) refreshCart().catch(() => {});
                  }}
                  className="flex h-12 items-center gap-3 rounded-lg bg-blue-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800"
                >
                  <span>
                    {currentUser?.role === "employee"
                      ? "Transaction"
                      : "Cart"}
                  </span>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-black">
                    {cartCount}
                  </span>
                </button>

                {isCartOpen && (
                  <section className="absolute right-0 top-14 z-30 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-200 bg-blue-950 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-bold text-white">
                          {currentUser?.role === "employee"
                            ? "Current Transaction"
                            : "Your Cart"}
                        </h2>
                        <span className="text-sm font-semibold text-blue-200">
                          {cartCount} {cartCount === 1 ? "item" : "items"}
                        </span>
                      </div>
                    </div>

                    {cartError && (
                      <p className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
                        {cartError}
                      </p>
                    )}

                    {loadingCart ? (
                      <div className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading cart...
                      </div>
                    ) : cartLines.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <p className="font-semibold text-slate-700">
                          Your cart is empty
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Add products to begin checkout.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="max-h-80 overflow-y-auto">
                          {cartLines.map((item) => (
                            <div
                              key={item.product_id}
                              className="border-b border-slate-100 px-5 py-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {item.name}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.category}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold text-blue-950">
                                    ${formatMoney(item.unitPrice)} each
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.product_id)}
                                  aria-label={
                                    currentUser?.role === "employee"
                                      ? `Remove ${item.name} from the current transaction`
                                      : `Remove ${item.name} from cart`
                                  }
                                  className="text-xs font-bold text-red-600 hover:text-red-800"
                                >
                                  {currentUser?.role === "employee"
                                    ? "Remove item"
                                    : "Remove"}
                                </button>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(
                                        item.product_id,
                                        item.quantity - 1
                                      )
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
                                    aria-label={`Decrease quantity of ${item.name}`}
                                  >
                                    −
                                  </button>
                                  <span className="min-w-6 text-center text-sm font-bold">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateQuantity(
                                        item.product_id,
                                        item.quantity + 1
                                      )
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
                                    aria-label={`Increase quantity of ${item.name}`}
                                  >
                                    +
                                  </button>
                                </div>

                                <span className="text-sm font-black text-blue-950">
                                  ${formatMoney(item.lineTotal)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="border-t-2 border-slate-200 bg-slate-50 px-5 py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="block text-sm font-semibold text-slate-600">
                                Cart Total
                              </span>
                              <span className="text-xl font-black text-blue-950">
                                ${formatMoney(cartTotal)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={removeAllFromCart}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50"
                            >
                              {currentUser?.role === "employee"
                                ? "Clear transaction"
                                : "Clear cart"}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={openCheckout}
                            className="mt-4 w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white transition hover:bg-red-700"
                          >
                            Proceed to Checkout
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="h-12 rounded-lg border-2 border-red-600 bg-white px-5 text-sm font-bold text-red-600 transition hover:bg-red-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        {priceDiscountSuccess && (
          <p
            role="status"
            className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"
          >
            {priceDiscountSuccess}
          </p>
        )}

        <div className="mb-6 rounded-xl bg-blue-950 px-6 py-6 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-200">
            {currentUser?.role === "employee"
              ? "Staff Workspace"
              : "Dallas College Library"}
          </p>
          <h2 className="mt-1 text-3xl font-black">
            {currentUser?.role === "employee"
              ? "Staff Dashboard"
              : "Self-Checkout"}
          </h2>
          <p className="mt-2 text-sm text-blue-100">
            {currentUser?.role === "employee"
              ? "Manage product discounts and the active transaction."
              : "Select the items you would like to check out."}
          </p>
        </div>

        {currentUser?.role === "employee" && (
          <section
            aria-labelledby="staff-tasks-title"
            className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="staff-tasks-title"
                  className="text-lg font-black text-blue-950"
                >
                  Staff Tasks
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose a task to continue working.
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-600">
                Active transaction: {cartCount}{" "}
                {cartCount === 1 ? "item" : "items"} · $
                {formatMoney(cartTotal)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("staff-product-list")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left transition hover:border-amber-400"
              >
                <span className="block font-bold text-amber-900">
                  Change a catalog price
                </span>
                <span className="mt-1 block text-sm text-amber-800">
                  Update a product price for future transactions and record why.
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(true);
                  refreshCart().catch(() => {});
                }}
                className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-left transition hover:border-blue-400"
              >
                <span className="block font-bold text-blue-950">
                  Manage staff cart
                </span>
                <span className="mt-1 block text-sm text-blue-800">
                  Manage items in your staff cart.
                </span>
              </button>
            </div>
          </section>
        )}

        {currentUser?.role === "employee" && (
          <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-black text-blue-950">
                Manage a Student Transaction
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Load an in-progress transaction by student ID to remove items,
                cancel it, or record a transaction-only discount.
              </p>
              <form
                onSubmit={loadStaffTransaction}
                className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              >
                <label className="text-sm font-semibold text-slate-700">
                  Student ID
                  <input
                    required
                    value={staffStudentId}
                    onChange={(event) => {
                      setStaffStudentId(event.target.value);
                      setStaffTransaction(null);
                      setStaffTransactionError("");
                      setStaffTransactionMessage("");
                    }}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Confirm employee password
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={staffTransactionLoading}
                  className="rounded-lg bg-blue-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {staffTransactionLoading
                    ? "Loading..."
                    : "Load transaction"}
                </button>
              </form>

              {staffTransactionError && (
                <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                  {staffTransactionError}
                </p>
              )}
              {staffTransactionMessage && (
                <p role="status" className="mt-3 text-sm font-semibold text-green-700">
                  {staffTransactionMessage}
                </p>
              )}
            </div>

            {staffTransaction && (
              <div className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">
                      {staffTransaction.username} · Student ID{" "}
                      {staffTransaction.student_id}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      In-progress transaction · {staffTransaction.cart.length}{" "}
                      {staffTransaction.cart.length === 1 ? "product" : "products"}{" "}
                      · Total $
                      {formatMoney(
                        staffTransaction.cart.reduce(
                          (total, item) =>
                            total +
                            Number(item.discounted_price ?? item.price) *
                              Number(item.quantity),
                          0
                        )
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={
                      staffTransactionLoading ||
                      staffTransaction.cart.length === 0
                    }
                    onClick={cancelStaffTransaction}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel transaction
                  </button>
                </div>

                {staffTransaction.cart.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                    This student has no items in the current transaction.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {staffTransaction.cart.map((item) => {
                      const currentPrice = Number(
                        item.discounted_price ?? item.price
                      );
                      const draft =
                        staffDiscountDrafts[item.product_id] ?? {
                          new_price: "",
                          reason: "",
                        };

                      return (
                        <li key={item.product_id} className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-900">
                                {item.name} × {item.quantity}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                Unit price: $
                                {formatMoney(currentPrice)}
                                {item.discounted_by && (
                                  <span className="ml-2 text-green-700">
                                    (discounted by {item.discounted_by})
                                  </span>
                                )}
                              </p>
                              {item.discount_reason && (
                                <p className="mt-1 text-sm text-slate-500">
                                  Reason: {item.discount_reason}
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={staffBusyItemId === item.product_id}
                              onClick={() =>
                                removeStaffTransactionItem(item.product_id)
                              }
                              className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Remove product
                            </button>
                          </div>

                          <form
                            onSubmit={(event) =>
                              applyStaffTransactionDiscount(event, item)
                            }
                            className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end"
                          >
                            <label className="text-sm font-semibold text-slate-700">
                              New unit price
                              <input
                                required
                                type="number"
                                min="0"
                                max={Math.max(0, currentPrice - 0.01).toFixed(2)}
                                step="0.01"
                                value={draft.new_price}
                                onChange={(event) =>
                                  setStaffDiscountDrafts((drafts) => ({
                                    ...drafts,
                                    [item.product_id]: {
                                      ...draft,
                                      new_price: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                              />
                            </label>
                            <label className="text-sm font-semibold text-slate-700">
                              Reason for discount
                              <input
                                required
                                maxLength="500"
                                value={draft.reason}
                                onChange={(event) =>
                                  setStaffDiscountDrafts((drafts) => ({
                                    ...drafts,
                                    [item.product_id]: {
                                      ...draft,
                                      reason: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                              />
                            </label>
                            <button
                              type="submit"
                              disabled={
                                staffBusyItemId === item.product_id ||
                                currentPrice <= 0
                              }
                              className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {staffBusyItemId === item.product_id
                                ? "Saving..."
                                : "Apply discount"}
                            </button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        )}

        {currentUser?.role === "employee" && (
          <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-black text-slate-900">
                Product Price History
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review the old price, new price, reason, and staff member for
                recorded discounts.
              </p>
              <form
                onSubmit={loadPriceHistory}
                className="mt-3 flex flex-wrap items-end gap-3"
              >
                <label className="min-w-60 text-sm font-semibold text-slate-700">
                  Confirm employee password
                  <input
                    required
                    type="password"
                    autoComplete="current-password"
                    value={priceHistoryPassword}
                    onChange={(event) =>
                      setPriceHistoryPassword(event.target.value)
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loadingPriceHistory}
                  className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {loadingPriceHistory
                    ? "Loading History..."
                    : priceHistory
                      ? "Refresh History"
                      : "View History"}
                </button>
              </form>

              {priceHistoryError && (
                <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
                  {priceHistoryError}
                </p>
              )}
            </div>

            {priceHistory && (
              priceHistory.length === 0 ? (
                <p className="px-5 py-6 text-sm font-semibold text-slate-600">
                  No product price discounts have been recorded.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="px-5 py-3">Product</th>
                        <th scope="col" className="px-5 py-3 text-right">Old Price</th>
                        <th scope="col" className="px-5 py-3 text-right">New Price</th>
                        <th scope="col" className="px-5 py-3">Reason</th>
                        <th scope="col" className="px-5 py-3">Changed By</th>
                        <th scope="col" className="px-5 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {priceHistory.map((entry, index) => (
                        <tr
                          key={`${entry.product_id}-${entry.changed_at}-${index}`}
                        >
                          <th
                            scope="row"
                            className="whitespace-nowrap px-5 py-3 font-bold text-slate-900"
                          >
                            {entry.product_name} (#{entry.product_id})
                          </th>
                          <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">
                            ${Number(entry.old_price).toFixed(2)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-right font-bold text-green-700">
                            ${Number(entry.new_price).toFixed(2)}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {entry.reason}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                            {entry.changed_by}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                            {new Date(entry.changed_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </section>
        )}

        {cartError && !isCartOpen && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cartError}
          </div>
        )}

        {/* Browse all products or narrow the catalog to a course or bundle. */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black text-blue-950">
                Find course supplies
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose a course or named supply bundle to see its catalog items.
              </p>
            </div>

            <div className="grid w-full gap-3 md:max-w-2xl md:grid-cols-2">
              <label
                htmlFor="courseSelect"
                className="block text-sm font-bold text-slate-700"
              >
                Course
                <select
                  id="courseSelect"
                  value={selectedCourseId}
                  onChange={(event) => {
                    setSelectedCourseId(event.target.value);
                    setSelectedBundleId("");
                    setCategory("All");
                  }}
                  disabled={loadingCourses || courses.length === 0}
                  className="mt-2 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {loadingCourses
                      ? "Loading courses..."
                      : courses.length === 0
                      ? "No courses available"
                      : "All store products"}
                  </option>
                  {courses.map((course) => (
                    <option
                      key={getCourseId(course)}
                      value={getCourseId(course)}
                    >
                      {getCourseLabel(course)}
                    </option>
                  ))}
                </select>
              </label>

              <label
                htmlFor="bundleSelect"
                className="block text-sm font-bold text-slate-700"
              >
                Supply bundle
                <select
                  id="bundleSelect"
                  value={selectedBundleId}
                  onChange={(event) => {
                    setSelectedBundleId(event.target.value);
                    setSelectedCourseId("");
                    setCategory("All");
                  }}
                  disabled={loadingBundles || bundles.length === 0}
                  className="mt-2 w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {loadingBundles
                      ? "Loading bundles..."
                      : bundles.length === 0
                      ? "No bundles available"
                      : "All store products"}
                  </option>
                  {bundles.map((bundle) => (
                    <option
                      key={getBundleId(bundle)}
                      value={getBundleId(bundle)}
                    >
                      {bundle.bundle_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {courseError && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {courseError}
            </p>
          )}

          {bundleError && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {bundleError}
            </p>
          )}

          {selectedCourse && (
            <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
              <p className="font-bold text-blue-950">
                {getCourseLabel(selectedCourse)}
              </p>
              {selectedCourse.description &&
                selectedCourse.description !== selectedCourse.course_name && (
                  <p className="mt-1 text-sm text-blue-800">
                    {selectedCourse.description}
                  </p>
                )}
              <p className="mt-1 text-xs font-semibold text-blue-700">
                {Array.isArray(selectedCourse.products)
                  ? selectedCourse.products.length
                  : 0}{" "}
                assigned{" "}
                {(selectedCourse.products?.length ?? 0) === 1
                  ? "product"
                  : "products"}
              </p>
              
              <button
              type="button"
              onClick={addCourseBundleToCart}
              disabled={loadingCart || !selectedCourse.products?.length}
              className="mt-3 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
              {loadingCart ? "Adding products..." : "Add All Course Products to Cart"}
              </button>
            </div>
          )}

          {selectedBundle && (
            <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3">
              <p className="font-bold text-blue-950">
                {selectedBundle.bundle_name}
              </p>
              <p className="mt-1 text-xs font-semibold text-blue-700">
                {selectedBundle.products.length}{" "}
                {selectedBundle.products.length === 1 ? "item" : "items"} in
                this bundle. Add items individually at their catalog prices.
              </p>
            </div>
          )}
        </section>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`whitespace-nowrap rounded-lg px-5 py-3 text-sm font-bold transition ${
                  category === item
                    ? "bg-red-600 text-white shadow-sm"
                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div id="staff-product-list" className="mb-5 flex items-center justify-between scroll-mt-6">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {selectedCourse
                ? "Products for this Course"
                : selectedBundle
                ? `Items in ${selectedBundle.bundle_name}`
                : "Available Items"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCourse
                ? "These are the products assigned to the selected course."
                : selectedBundle
                ? "Select bundle items individually to add them to your cart."
                : "Select a product to add it to your cart."}
            </p>
          </div>
          <p className="text-sm font-bold text-slate-500">
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "item" : "items"}
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
            <h3 className="text-lg font-bold text-slate-900">
              No items found
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {selectedCourse
                ? "This course has no assigned products matching your search or category. Try clearing your search, choosing another category, or selecting a different course."
                : selectedBundle
                ? "This bundle has no catalog items matching your search or category. Try clearing your search or choosing a different bundle."
                : "Try another search or category."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const productId = getProductId(product);
              const selectedCartItem = cartItems.find(
                (item) => getProductId(item) === productId
              );
              const selectedQuantity = Number(
                selectedCartItem?.quantity ?? 0
              );
              const outOfStock = Number(product.quantity) <= 0;
              const productColors = Array.isArray(product.colors)
                ? product.colors
                : [];
              const selectedColorId =
                selectedColors[productId] ??
                (productColors.length > 0 ? getColorId(productColors[0]) : "");
              const selectedColor = productColors.find(
                (color) => String(getColorId(color)) === String(selectedColorId)
              );
              const hasSizes =
                Array.isArray(product.sizes) && product.sizes.length > 0;

              return (
                <article
                  key={productId}
                  className={`overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${
                    outOfStock
                      ? "border-slate-200 opacity-60"
                      : selectedQuantity > 0
                      ? "border-blue-700 ring-2 ring-blue-100"
                      : "border-slate-200 hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg"
                  }`}
                >
                  <div className="relative flex h-40 items-center justify-center bg-slate-100">
                    <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-blue-900 shadow-md">
                      <span className="text-3xl font-black text-white">
                        {String(product.name ?? "?").charAt(0)}
                      </span>
                    </div>

                    {selectedQuantity > 0 && (
                      <div className="absolute left-3 top-3 rounded-md bg-blue-900 px-3 py-1 text-xs font-bold text-white">
                        In cart: {selectedQuantity}
                      </div>
                    )}

                    {outOfStock && (
                      <div className="absolute right-3 top-3 rounded-md bg-red-600 px-3 py-1 text-xs font-bold text-white">
                        Out of Stock
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <p className="mb-2 text-xs font-black uppercase tracking-wide text-red-600">
                      {product.category}
                    </p>

                    <h3 className="min-h-6 text-lg font-black text-slate-900">
                      {product.name}
                    </h3>

                    <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                      {product.description}
                    </p>

                    {productColors.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                            Choose a color
                          </span>
                          <span className="text-xs font-semibold text-blue-900">
                            {selectedColor ? getColorName(selectedColor) : ""}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {productColors.map((color, index) => {
                            const colorId = getColorId(color);
                            const isSelected =
                              String(colorId) === String(selectedColorId);

                            return (
                              <button
                                key={colorId || `${productId}-color-${index}`}
                                type="button"
                                onClick={() =>
                                  setSelectedColors((previous) => ({
                                    ...previous,
                                    [productId]: colorId,
                                  }))
                                }
                                title={getColorName(color)}
                                aria-label={`Select ${getColorName(color)} for ${product.name}`}
                                aria-pressed={isSelected}
                                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                                  isSelected
                                    ? "border-blue-900 ring-2 ring-blue-200 ring-offset-2"
                                    : "border-slate-300 hover:border-blue-500"
                                }`}
                              >
                                <span
                                  className="h-6 w-6 rounded-full border border-black/10"
                                  style={{ backgroundColor: getColorHex(color) }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-xl font-black text-blue-950">
                        ${formatMoney(getProductPrice(product))}
                      </span>

                      <button
                        type="button"
                        disabled={outOfStock || loadingCart}
                        onClick={() => {
                          if (hasSizes) {
                            // Clothing: ask for a size before adding.
                            setPendingSizeId("");
                            setSizePickerProduct(product);
                          } else {
                            addToCart(product);
                          }
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                          outOfStock || loadingCart
                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                            : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                      >
                        {loadingCart ? "Please wait..." : "Add to Cart"}
                      </button>
                    </div>

                    {currentUser?.role === "employee" && (
                      <button
                        type="button"
                        disabled={Number(product.price) <= 0}
                        onClick={() => openPriceDiscount(product)}
                        className="mt-3 w-full rounded-lg border border-amber-300 px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Discount Price
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {priceDiscountProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <form
            onSubmit={submitPriceDiscount}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-xl font-black text-slate-900">
                Discount Catalog Price
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {priceDiscountProduct.name} currently costs $
                {formatMoney(getProductPrice(priceDiscountProduct))}. Enter a
                lower catalog price and explain the reason. This does not
                change a student&apos;s in-progress transaction.
              </p>
            </div>

            <label className="block text-sm font-semibold text-slate-700">
              New discounted price
              <input
                required
                type="number"
                min="0"
                max={Math.max(
                  0,
                  Number(priceDiscountProduct.price) - 0.01
                ).toFixed(2)}
                step="0.01"
                value={priceDiscountForm.new_price}
                onChange={(event) =>
                  setPriceDiscountForm((form) => ({
                    ...form,
                    new_price: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Reason for discount
              <textarea
                required
                maxLength="500"
                rows="3"
                value={priceDiscountForm.reason}
                onChange={(event) =>
                  setPriceDiscountForm((form) => ({
                    ...form,
                    reason: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Confirm employee password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={priceDiscountForm.password}
                onChange={(event) =>
                  setPriceDiscountForm((form) => ({
                    ...form,
                    password: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            {priceDiscountError && (
              <p role="alert" className="text-sm font-semibold text-red-700">
                {priceDiscountError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                disabled={savingPriceDiscount}
                onClick={() => {
                  setPriceDiscountProduct(null);
                  setPriceDiscountError("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPriceDiscount}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {savingPriceDiscount ? "Saving..." : "Apply Discount"}
              </button>
            </div>
          </form>
        </div>
      )}

      {cartCount > 0 && (
        <div className="sticky bottom-0 z-20 border-t border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 lg:px-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Cart Total
              </p>
              <p className="text-2xl font-black text-blue-950">
                ${formatMoney(cartTotal)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCartOpen(true);
                refreshCart().catch(() => {});
              }}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-red-700"
            >
              View Cart ({cartCount})
            </button>
          </div>
        </div>
      )}

      {sizePickerProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-blue-950 px-6 py-5 text-white">
              <h2 className="text-xl font-black">Select a Size</h2>
              <p className="mt-1 text-sm text-blue-200">
                {sizePickerProduct.name} — $
                {formatMoney(getProductPrice(sizePickerProduct))}
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Size
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {sizePickerProduct.sizes.map((size, index) => {
                    const sizeId = getSizeId(size);
                    const isSelected = String(sizeId) === String(pendingSizeId);

                    return (
                      <button
                        key={sizeId || `size-${index}`}
                        type="button"
                        onClick={() => setPendingSizeId(sizeId)}
                        aria-pressed={isSelected}
                        className={`rounded-lg border px-2 py-3 text-sm font-bold transition ${
                          isSelected
                            ? "border-blue-900 bg-blue-50 text-blue-950"
                            : "border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50"
                        }`}
                      >
                        {getSizeName(size)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSizePickerProduct(null)}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pendingSizeId === "" || loadingCart}
                  onClick={async () => {
                    const product = sizePickerProduct;
                    setSizePickerProduct(null);
                    await addToCart(product);
                  }}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingSizeId === "" ? "Choose a size" : "Add to Cart"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="bg-blue-950 px-6 py-5 text-white">
              <h2 className="text-xl font-black">Checkout</h2>
              <p className="mt-1 text-sm text-blue-200">
                Enter your student ID if you qualify for the student discount.
              </p>
            </div>

            <form onSubmit={completeCheckout} className="space-y-5 p-6">
              <div className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600">
                    Cart subtotal
                  </span>
                  <span className="text-xl font-black text-blue-950">
                    ${formatMoney(cartTotal)}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  A valid student ID applies 10% off eligible Books items.
                  The backend verifies the ID and calculates the final amount.
                </p>

                <div className="mt-3 space-y-2">
                  {cartLines.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex justify-between gap-3 text-sm text-slate-600"
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>${formatMoney(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="studentId"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Student ID{" "}
                  {paymentMethod === "voucher" ? "(required)" : "(optional)"}
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="Enter your student ID (e.g. S10001)"
                  autoComplete="off"
                  required={paymentMethod === "voucher"}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Payment method
                </label>
                <div
                  className={`grid gap-3 ${
                    currentUser?.role === "student"
                      ? "grid-cols-3"
                      : "grid-cols-2"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`rounded-lg border px-4 py-3 text-sm font-bold ${
                      paymentMethod === "cash"
                        ? "border-blue-900 bg-blue-50 text-blue-950"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`rounded-lg border px-4 py-3 text-sm font-bold ${
                      paymentMethod === "card"
                        ? "border-blue-900 bg-blue-50 text-blue-950"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Card
                  </button>
                  {currentUser?.role === "student" && (
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("voucher")}
                      className={`rounded-lg border px-4 py-3 text-sm font-bold ${
                        paymentMethod === "voucher"
                          ? "border-blue-900 bg-blue-50 text-blue-950"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      Voucher
                    </button>
                  )}
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div>
                  <label
                    htmlFor="cashReceived"
                    className="mb-2 block text-sm font-bold text-slate-700"
                  >
                    Cash received
                  </label>
                  <input
                    id="cashReceived"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => setCashReceived(event.target.value)}
                    placeholder="Enter amount received"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700"
                    required
                  />
                </div>
              )}

              {paymentMethod === "card" && (
                <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                  Card checkout will use the backend’s simulated card approval.
                </p>
              )}

              {paymentMethod === "voucher" && (
                <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                  The total will be charged to the student voucher for the ID
                  entered above. The ID must match your account.
                </p>
              )}

              {checkoutError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {checkoutError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(false)}
                  disabled={checkoutLoading}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={checkoutLoading || cartLines.length === 0}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {checkoutLoading ? "Processing..." : "Complete Checkout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReceiptOpen && receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="bg-blue-950 px-6 py-5 text-center text-white">
              <h2 className="text-xl font-black">Checkout Complete</h2>
              <p className="mt-1 text-sm text-blue-200">
                {receipt.message}
              </p>
            </div>

            <div className="space-y-4 p-6">
              <div className="border-b border-dashed border-slate-300 pb-4 text-center">
                <p className="font-black text-slate-900">
                  Dallas College Library
                </p>
                <p className="mt-1 text-xs text-slate-500">{receipt.date}</p>
                {receipt.receiptId && (
                  <p className="mt-1 text-xs text-slate-500">
                    Receipt #: {receipt.receiptId}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {receipt.items.map((item, index) => (
                  <div
                    key={`${item.product_id}-${index}`}
                    className="flex justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-700">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold text-slate-900">
                      ${formatMoney(item.line_total)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>${formatMoney(receipt.subtotal)}</span>
                </div>

                {receipt.studentDiscountApplied && (
                  <div className="flex justify-between text-sm font-semibold text-green-700">
                    <span>Student discount (10% on Books)</span>
                    <span>−${formatMoney(receipt.studentDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span>${formatMoney(receipt.total)}</span>
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  Payment: {PAYMENT_LABELS[receipt.paymentMethod]}
                </p>

                {receipt.change != null && (
                  <p className="mt-1 text-sm text-slate-500">
                    Change: ${formatMoney(receipt.change)}
                  </p>
                )}

                {receipt.voucherBalance != null && (
                  <p className="mt-1 text-sm text-slate-500">
                    Voucher balance remaining: $
                    {formatMoney(receipt.voucherBalance)}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="receiptPhone"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  Phone number for receipt text
                </label>
                <input
                  id="receiptPhone"
                  type="tel"
                  value={receiptPhone}
                  onChange={(event) => setReceiptPhone(event.target.value)}
                  placeholder="Enter phone number"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700"
                />
                <p className="mt-2 text-xs text-slate-500">
                  This opens your device’s messaging app with the receipt filled
                  in. You’ll need to send the text yourself.
                </p>
              </div>

              {checkoutError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {checkoutError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={textReceipt}
                  className="flex-1 rounded-lg bg-blue-900 px-4 py-3 text-sm font-bold text-white hover:bg-blue-800"
                >
                  Prepare Text
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptOpen(false);
                    setReceipt(null);
                    setReceiptPhone("");
                    setCheckoutError("");
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductCatalog;