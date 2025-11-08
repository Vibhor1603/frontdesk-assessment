import { useState } from "react";
import toast from "react-hot-toast";

export function showBookingToast(onSubmit) {
  return new Promise((resolve) => {
    const toastId = toast.custom(
      (t) => (
        <BookingToastContent
          visible={t.visible}
          onSubmit={(bookingData) => {
            toast.dismiss(toastId);
            resolve(bookingData);
            onSubmit(bookingData);
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

function BookingToastContent({ visible, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    service: "",
    appointmentDate: "",
    appointmentTime: "",
    notes: "",
  });

  const [errors, setErrors] = useState({});

  const services = [
    "Haircut",
    "Hair Coloring",
    "Styling",
    "Manicure",
    "Pedicure",
    "Facial",
    "Massage",
    "Spa Package",
  ];

  const validate = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = "Name required";
    if (!formData.customerEmail.trim())
      newErrors.customerEmail = "Email required";
    if (!formData.service) newErrors.service = "Service required";
    if (!formData.appointmentDate) newErrors.appointmentDate = "Date required";
    if (!formData.appointmentTime) newErrors.appointmentTime = "Time required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div
      className={`${
        visible ? "animate-enter" : "animate-leave"
      } max-w-lg w-full bg-white/10 backdrop-blur-xl shadow-lg rounded-3xl pointer-events-auto border border-white/20`}
    >
      <div className="p-6">
        <h3 className="text-xl font-bold text-white mb-4">
          Book Your Appointment
        </h3>

        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your Name *"
            value={formData.customerName}
            onChange={(e) =>
              setFormData({ ...formData, customerName: e.target.value })
            }
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20 placeholder-white/40"
          />
          {errors.customerName && (
            <p className="text-red-400 text-sm">{errors.customerName}</p>
          )}

          <input
            type="email"
            placeholder="Email *"
            value={formData.customerEmail}
            onChange={(e) =>
              setFormData({ ...formData, customerEmail: e.target.value })
            }
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20 placeholder-white/40"
          />
          {errors.customerEmail && (
            <p className="text-red-400 text-sm">{errors.customerEmail}</p>
          )}

          <input
            type="tel"
            placeholder="Phone (optional)"
            value={formData.customerPhone}
            onChange={(e) =>
              setFormData({ ...formData, customerPhone: e.target.value })
            }
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20 placeholder-white/40"
          />

          <select
            value={formData.service}
            onChange={(e) =>
              setFormData({ ...formData, service: e.target.value })
            }
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20"
            style={{
              colorScheme: "dark",
            }}
          >
            <option
              value=""
              style={{ backgroundColor: "#1f2937", color: "#fff" }}
            >
              Select Service *
            </option>
            {services.map((service) => (
              <option
                key={service}
                value={service}
                style={{ backgroundColor: "#1f2937", color: "#fff" }}
              >
                {service}
              </option>
            ))}
          </select>
          {errors.service && (
            <p className="text-red-400 text-sm">{errors.service}</p>
          )}

          <input
            type="date"
            value={formData.appointmentDate}
            onChange={(e) =>
              setFormData({ ...formData, appointmentDate: e.target.value })
            }
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20"
          />
          {errors.appointmentDate && (
            <p className="text-red-400 text-sm">{errors.appointmentDate}</p>
          )}

          <input
            type="time"
            value={formData.appointmentTime}
            onChange={(e) =>
              setFormData({ ...formData, appointmentTime: e.target.value })
            }
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20"
          />
          {errors.appointmentTime && (
            <p className="text-red-400 text-sm">{errors.appointmentTime}</p>
          )}

          <textarea
            placeholder="Additional notes (optional)"
            value={formData.notes}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            rows={2}
            className="w-full px-4 py-2 bg-white/10 text-white rounded-xl border border-white/20 placeholder-white/40"
          />
        </div>
      </div>

      <div className="flex gap-3 px-6 pb-6">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-xl transition-all font-medium"
        >
          Book Appointment
        </button>
      </div>
    </div>
  );
}
