import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button, Card, EmptyState } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <Card>
        <EmptyState
          icon={Compass}
          title="৪০৪ — পাতাটি নেই"
          description="যে লিংকে এসেছেন সেটা ভুল, অথবা পাতাটি সরিয়ে ফেলা হয়েছে।"
          action={
            <div className="flex gap-2.5">
              <Button as={Link} to="/">হোমে যান</Button>
              <Button as={Link} to="/products" variant="outline">পণ্য দেখুন</Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}
