import { useState } from "react";
import toast from "react-hot-toast";

export function showEmailToast(onSubmit) {
  return new Promise((resolve) => {
    const toastId = toast.custom(
      (t) => (
        <EmailToastContent
          visible={t.visible}
          onSubmit={(email) => {
            toast.dismiss(toastId);
            resolve(email);
            onSubmit(email);
          }}
          onCancel={() => {
            toast.dismiss(toastId);
            resolve(null);
          }}
        />
      ),
      {
        duration: Infinity,
        position: "top-center",
      }
    );
  });
}

function EmailToastContent({ visible, onSubmit, onCancel }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    onSubmit(email);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div
      className={`${
        visible ? "animate-enter" : "animate-leave"
      } max-w-md w-full bg-white/10 backdrop-blur-xl shadow-lg rounded-3xl pointer-events-auto flex flex-col border border-white/20`}
    >
      <div className="p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-6 w-6 text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-medium text-white">Email Required</p>
            <p className="mt-1 text-sm text-white/70">
              We'll send you the answer as soon as we hear back from our
              supervisor.
            </p>
            <div className="mt-4">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKeyPress}
                placeholder="your-email@example.com"
                className="w-full px-4 py-3 bg-white/10 backdrop-blur-xl text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/50 border border-white/20 placeholder-white/40"
                autoFocus
              />
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-3 px-6 pb-6">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all backdrop-blur-xl border border-white/20"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl transition-all font-medium"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
