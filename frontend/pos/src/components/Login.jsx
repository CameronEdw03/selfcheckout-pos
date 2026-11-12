import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState(location.state?.username ?? "");
    const [password, setPassword] = useState("");
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [notice, setNotice] = useState(location.state?.notice ?? "");

    const handleLogin = async (event) => {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await fetch("http://127.0.0.1:8000/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username,
                    password: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.detail || "Invalid username or password.");
                return;
            }

            const user = {
                user_id: data.user_id,
                username: data.username,
                role: data.role,
                student_id: data.student_id,
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                phone: data.phone,
            };

            localStorage.setItem("user", JSON.stringify(user));

            navigate(
                user.role === "manager"
                    ? "/manager-dashboard"
                    : user.role === "employee"
                        ? "/staff-dashboard"
                    : "/student-dashboard"
            );

        } catch {
            setError("Unable to connect to the checkout system.");
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (event) => {
        event.preventDefault();

        setError("");
        setLoading(true);

        try {
            const response = await fetch("http://127.0.0.1:8000/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    username: username.trim(),
                    password,
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    email: email.trim() || null,
                    phone: phone.trim() || null,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.detail || "Unable to create your student account.");
                return;
            }

            localStorage.removeItem("user");
            setPassword("");
            setIsRegistering(false);
            setNotice("Your account was created. Sign in with your new username and password.");
            setUsername(data.username);
        } catch {
            setError("Unable to connect to the checkout system.");
        } finally {
            setLoading(false);
        }
    };

    function switchMode(registering) {
        setIsRegistering(registering);
        setError("");
        setNotice("");
    }

    return (
        <div className="min-h-screen bg-slate-200 flex items-center justify-center p-6">

            <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-300">

                <div className="grid md:grid-cols-2">

                    {/* Left Panel */}
                    <div className="bg-blue-950 text-white p-10 md:p-12 flex flex-col justify-between min-h-[600px]">

                        <div>
                            <div className="flex items-center gap-4 mb-10">
                                <div className="flex items-center justify-center w-16 h-16 bg-white rounded-xl">
                                    <span className="text-2xl font-black text-blue-950">
                                        DC
                                    </span>
                                </div>

                                <div>
                                    <p className="text-xl font-bold">
                                        Dallas College
                                    </p>

                                    <p className="text-sm text-blue-200">
                                        Library Services
                                    </p>
                                </div>
                            </div>

                            <div className="border-l-4 border-red-600 pl-5">
                                <p className="text-sm font-semibold uppercase tracking-widest text-blue-200">
                                    Self-Checkout
                                </p>

                                <h1 className="mt-3 text-4xl font-black leading-tight">
                                    Library
                                    <br />
                                    Checkout
                                </h1>
                            </div>

                            <p className="mt-8 max-w-sm text-blue-100 leading-7">
                                Sign in to access the library self-checkout system
                                and begin checking out your items.
                            </p>
                        </div>

                        <div className="mt-12">
                            <div className="flex items-center gap-3 text-sm text-blue-200">
                                <div className="h-2 w-2 rounded-full bg-green-400" />
                                <span>Checkout system available</span>
                            </div>
                        </div>

                    </div>

                    {/* Right Panel */}
                    <div className="p-8 md:p-12 flex items-center">

                        <div className="w-full max-w-md mx-auto">

                            <div className="mb-8">
                                <p className="text-sm font-bold uppercase tracking-widest text-red-600">
                                    Member Access
                                </p>

                                <h2 className="mt-2 text-3xl font-black text-slate-900">
                                    {isRegistering ? "Create Student Account" : "Sign In"}
                                </h2>

                                <p className="mt-2 text-slate-500">
                                    {isRegistering
                                        ? "Create an account to access student checkout."
                                        : "Enter your library account credentials."}
                                </p>
                            </div>

                            <form
                                onSubmit={isRegistering ? handleRegister : handleLogin}
                                className="space-y-6"
                            >
                                {notice && (
                                    <p
                                        role="status"
                                        className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                                    >
                                        {notice}
                                    </p>
                                )}

                                {/* Username */}
                                <div>
                                    <label
                                        htmlFor="username"
                                        className="block text-sm font-bold text-slate-700 mb-2"
                                    >
                                        Username
                                    </label>

                                    <input
                                        id="username"
                                        type="text"
                                        required
                                        minLength={isRegistering ? 3 : undefined}
                                        maxLength={50}
                                        autoComplete="username"
                                        placeholder={isRegistering ? "Choose a username" : "Enter username"}
                                        value={username}
                                        onChange={(event) =>
                                            setUsername(event.target.value)
                                        }
                                        className="w-full h-14 px-4 rounded-xl border-2 border-slate-200
                                                   bg-slate-50 text-slate-900
                                                   placeholder-slate-400
                                                   outline-none transition
                                                   focus:border-blue-700
                                                   focus:bg-white
                                                   focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                {/* Password */}
                                <div>
                                    <label
                                        htmlFor="password"
                                        className="block text-sm font-bold text-slate-700 mb-2"
                                    >
                                        Password
                                    </label>

                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        minLength={isRegistering ? 8 : undefined}
                                        maxLength={255}
                                        autoComplete="current-password"
                                        placeholder={isRegistering ? "Create a password (8+ characters)" : "Enter password"}
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        className="w-full h-14 px-4 rounded-xl border-2 border-slate-200
                                                   bg-slate-50 text-slate-900
                                                   placeholder-slate-400
                                                   outline-none transition
                                                   focus:border-blue-700
                                                   focus:bg-white
                                                   focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>

                                {isRegistering && (
                                    <>
                                    <div>
                                        <label
                                            htmlFor="firstName"
                                            className="block text-sm font-bold text-slate-700 mb-2"
                                        >
                                            First name
                                        </label>

                                        <input
                                            id="firstName"
                                            type="text"
                                            required
                                            maxLength={100}
                                            autoComplete="given-name"
                                            placeholder="Enter your first name"
                                            value={firstName}
                                            onChange={(event) => setFirstName(event.target.value)}
                                            className="w-full h-14 px-4 rounded-xl border-2 border-slate-200
                                                       bg-slate-50 text-slate-900 placeholder-slate-400
                                                       outline-none transition focus:border-blue-700
                                                       focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="lastName"
                                            className="block text-sm font-bold text-slate-700 mb-2"
                                        >
                                            Last name
                                        </label>
                                        <input
                                            id="lastName"
                                            type="text"
                                            required
                                            maxLength={100}
                                            autoComplete="family-name"
                                            placeholder="Enter your last name"
                                            value={lastName}
                                            onChange={(event) => setLastName(event.target.value)}
                                            className="w-full h-14 px-4 rounded-xl border-2 border-slate-200
                                                       bg-slate-50 text-slate-900 placeholder-slate-400
                                                       outline-none transition focus:border-blue-700
                                                       focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="email"
                                            className="block text-sm font-bold text-slate-700 mb-2"
                                        >
                                            Email <span className="font-normal text-slate-400">(optional)</span>
                                        </label>
                                        <input
                                            id="email"
                                            type="email"
                                            maxLength={254}
                                            autoComplete="email"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(event) => setEmail(event.target.value)}
                                            className="w-full h-14 px-4 rounded-xl border-2 border-slate-200
                                                       bg-slate-50 text-slate-900 placeholder-slate-400
                                                       outline-none transition focus:border-blue-700
                                                       focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label
                                            htmlFor="phone"
                                            className="block text-sm font-bold text-slate-700 mb-2"
                                        >
                                            Phone <span className="font-normal text-slate-400">(optional)</span>
                                        </label>
                                        <input
                                            id="phone"
                                            type="tel"
                                            maxLength={30}
                                            autoComplete="tel"
                                            placeholder="Enter your phone number"
                                            value={phone}
                                            onChange={(event) => setPhone(event.target.value)}
                                            className="w-full h-14 px-4 rounded-xl border-2 border-slate-200
                                                       bg-slate-50 text-slate-900 placeholder-slate-400
                                                       outline-none transition focus:border-blue-700
                                                       focus:bg-white focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>
                                    </>
                                )}

                                {/* Error */}
                                {error && (
                                    <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                                                !
                                            </div>

                                            <p className="text-sm font-semibold text-red-700">
                                                {error}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-14 rounded-xl bg-red-600
                                               text-white font-bold text-base
                                               shadow-md
                                               transition duration-200
                                               hover:bg-red-700
                                               hover:shadow-lg
                                               disabled:cursor-not-allowed
                                               disabled:bg-slate-400
                                               focus:outline-none
                                               focus:ring-4
                                               focus:ring-red-200"
                                >
                                    {loading
                                        ? isRegistering
                                            ? "Creating Account..."
                                            : "Signing In..."
                                        : isRegistering
                                            ? "Create Student Account"
                                            : "Sign In"}
                                </button>

                            </form>

                            <p className="mt-5 text-center text-sm text-slate-600">
                                {isRegistering ? "Already have an account?" : "New student?"}{" "}
                                <button
                                    type="button"
                                    onClick={() => switchMode(!isRegistering)}
                                    className="font-bold text-blue-800 underline hover:text-blue-950"
                                >
                                    {isRegistering ? "Sign in" : "Create an account"}
                                </button>
                            </p>

                            {/* Bottom Information */}
                            <div className="mt-10 border-t border-slate-200 pt-6">

                                <div className="flex items-center justify-between text-xs text-slate-400">
                                    <span>Dallas College Library</span>
                                    <span>Self-Checkout</span>
                                </div>

                                <div className="mt-4 flex gap-1">
                                    <div className="h-1 flex-1 rounded-full bg-blue-950" />
                                    <div className="h-1 flex-1 rounded-full bg-white border border-slate-200" />
                                    <div className="h-1 flex-1 rounded-full bg-red-600" />
                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </div>

        </div>
    );
}

export default Login;
