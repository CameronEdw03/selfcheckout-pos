import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  const [products, setProducts] = useState([]);
  const [selectedColors, setSelectedColors] = useState({});
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [cartItems, setCartItems] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");

  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState("");
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

      setCurrentUser(user);
    } catch {
      localStorage.removeItem("user");
      navigate("/login");
    }
  }, [navigate]);

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

        const productsById = new Map(
          productsWithColors.map((product) => [getProductId(product), product])
        );

        const mergedProducts = baseProducts.map((product) => {
          const colorProduct = productsById.get(getProductId(product));

          return {
            ...product,
            colors: colorProduct?.colors ?? product.colors ?? [],
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

  // When a course is selected, browse only its assigned products.
  // With no course selected, browse the entire store.
  const filteredProducts = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const productsToBrowse = selectedCourse
      ? Array.isArray(selectedCourse.products)
        ? selectedCourse.products
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
  }, [products, selectedCourse, category, search]);

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
      // selected color is shown in the catalog, but is not persisted in the
      // cart until the backend cart/order schema supports color_id.
      const response = await fetch(url.toString(), {
        method: "POST",
      });

      await readResponse(response);
      await refreshCart();
    } catch (err) {
      setCartError(err.message || "Unable to add this product to your cart.");
    }
  }

  // Remove one product from the cart.
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
      `Payment: ${receipt.paymentMethod === "cash" ? "Cash" : "Card"}`,
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
                    Customer
                  </p>
                  <p className="text-sm font-bold text-blue-950">
                    {currentUser.username}
                  </p>
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
                  <span>Cart</span>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-2 text-xs font-black">
                    {cartCount}
                  </span>
                </button>

                {isCartOpen && (
                  <section className="absolute right-0 top-14 z-30 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="border-b border-slate-200 bg-blue-950 px-5 py-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-bold text-white">Your Cart</h2>
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
                                  className="text-xs font-bold text-red-600 hover:text-red-800"
                                >
                                  Remove
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
                              Clear cart
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
        <div className="mb-6 rounded-xl bg-blue-950 px-6 py-6 text-white shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-200">
            Dallas College Library
          </p>
          <h2 className="mt-1 text-3xl font-black">Self-Checkout</h2>
          <p className="mt-2 text-sm text-blue-100">
            Select the items you would like to check out.
          </p>
        </div>

        {cartError && !isCartOpen && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {cartError}
          </div>
        )}

        {/* Browse all store products or narrow the catalog to a course. */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black text-blue-950">
                Find supplies by course
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Choose a course to see the products assigned to it.
              </p>
            </div>

            <div className="w-full md:max-w-md">
              <label
                htmlFor="courseSelect"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Course
              </label>
              <select
                id="courseSelect"
                value={selectedCourseId}
                onChange={(event) => {
                  setSelectedCourseId(event.target.value);
                  setCategory("All");
                }}
                disabled={loadingCourses || courses.length === 0}
                className="w-full rounded-lg border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {loadingCourses
                    ? "Loading courses..."
                    : courses.length === 0
                    ? "No courses available"
                    : "All store products"}
                </option>
                {courses.map((course) => (
                  <option key={getCourseId(course)} value={getCourseId(course)}>
                    {getCourseLabel(course)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {courseError && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {courseError}
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

        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {selectedCourse ? "Products for this Course" : "Available Items"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedCourse
                ? "These are the products assigned to the selected course."
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
                        onClick={() => addToCart(product)}
                        className={`rounded-lg px-4 py-2 text-sm font-black transition ${
                          outOfStock || loadingCart
                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                            : "bg-red-600 text-white hover:bg-red-700"
                        }`}
                      >
                        {loadingCart ? "Please wait..." : "Add to Cart"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

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
                  Student ID (optional)
                </label>
                <input
                  id="studentId"
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  placeholder="Enter your student ID"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-700"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-700">
                  Payment method
                </label>
                <div className="grid grid-cols-2 gap-3">
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
                  Payment: {receipt.paymentMethod === "cash" ? "Cash" : "Card"}
                </p>

                {receipt.change != null && (
                  <p className="mt-1 text-sm text-slate-500">
                    Change: ${formatMoney(receipt.change)}
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