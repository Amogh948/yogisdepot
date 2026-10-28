import { Helmet } from "react-helmet-async";
import { ExhibitionSignupForm } from "../../components/home/ExhibitionSignupForm";

export function SurveyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl py-4">
      <Helmet>
        <title>Survey | Yogi&apos;s Depot</title>
        <meta name="description" content="Share your name, phone, email, and Calgary quadrant." />
      </Helmet>
      <ExhibitionSignupForm />
    </div>
  );
}
