import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FaqSectionAccordion } from "@/components/faq/FaqSectionAccordion";
import { FAQ_SECTIONS } from "@/content/faq-content";

interface FaqContentProps {
  searchLabel?: string;
}

export function FaqContent({ searchLabel = "Search in documentation" }: FaqContentProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const matchingSections = useMemo(() => {
    if (!searchTerm.trim()) {
      return FAQ_SECTIONS;
    }

    const normalized = searchTerm.trim().toLowerCase();
    return FAQ_SECTIONS.filter(
      (section) =>
        section.title.toLowerCase().includes(normalized) ||
        section.items.some(
          (item) =>
            item.question.toLowerCase().includes(normalized) || item.answer.toLowerCase().includes(normalized),
        ),
    );
  }, [searchTerm]);

  return (
    <div className="space-y-8">
      <div className="glass rounded-xl p-4 sm:p-5">
        <label htmlFor="faq-search" className="text-sm font-medium text-foreground mb-2 block">
          {searchLabel}
        </label>
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <Input
            id="faq-search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by feature, issue, or keyword..."
            className="pl-9"
            aria-label="Search FAQ and documentation"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Tip: Search terms like "API", "voice", "subscription", or "ticket".
        </p>
      </div>

      <div className="space-y-5">
        {matchingSections.map((section) => (
          <FaqSectionAccordion key={section.id} section={section} searchTerm={searchTerm} />
        ))}
      </div>

      {matchingSections.length === 0 ? (
        <div className="glass rounded-xl p-6 text-center text-sm text-muted-foreground">
          No results found for this search. Try a different keyword.
        </div>
      ) : null}
    </div>
  );
}
