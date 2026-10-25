import { FormEvent, useState } from "react";
import { Button } from "../ui/Button";
import { Input, Select } from "../ui/Input";
import { api, ApiError, unwrap } from "../../services/api/client";

const QUADRANTS = [
  { value: "NW", label: "Northwest (NW)" },
  { value: "NE", label: "Northeast (NE)" },
  { value: "SW", label: "Southwest (SW)" },
  { value: "SE", label: "Southeast (SE)" },
  { value: "Other", label: "Outside Calgary" },
] as const;

export function ExhibitionSignupForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [quadrant, setQuadrant] = useState("");
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }
    if (digits.length < 8) {
      setError("Enter a valid phone number.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (!quadrant) {
      setError("Choose the quadrant you live in.");
      return;
    }
    setSubmitting(true);
    try {
      await unwrap(
        api.post("/exhibition-leads", {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          quadrant,
          company,
        }),
      );
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      className="rounded-[16px] border border-yd-border bg-white px-4 py-5 shadow-soft sm:px-6"
      aria-labelledby="exhibition-signup-title"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-yd-saffron">Exhibition</p>
      <h2 id="exhibition-signup-title" className="mt-1 font-display text-2xl text-yd-forest">
        Leave your details
      </h2>
      <p className="mt-1 max-w-xl text-sm text-yd-muted">
        Visiting us at the exhibition? Share your name, phone, email, and Calgary quadrant so we can follow up.
      </p>
      {done ? (
        <p className="mt-4 rounded-xl bg-yd-green/10 px-4 py-3 text-sm font-medium text-yd-forest" role="status">
          Thanks — your details are saved. We’ll be in touch.
        </p>
      ) : (
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <Input label="Name" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input
            label="Phone number"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Select
            label="Quadrant you live in"
            name="quadrant"
            value={quadrant}
            onChange={(e) => setQuadrant(e.target.value)}
            required
          >
            <option value="">Select a quadrant</option>
            {QUADRANTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <label className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
            Company
            <input
              tabIndex={-1}
              autoComplete="off"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-yd-error sm:col-span-2">{error}</p> : null}
          <div className="sm:col-span-2">
            <Button type="submit" loading={submitting} disabled={submitting}>
              Submit details
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
