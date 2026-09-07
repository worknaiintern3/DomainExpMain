import React, { useState } from 'react';
import { FAQ_ITEMS } from '../help.reference';

interface FaqSectionProps {
  searchFilter: string;
}

export const FaqSection: React.FC<FaqSectionProps> = ({ searchFilter }) => {
  const [openFaqIds, setOpenFaqIds] = useState<Record<string, boolean>>({
    'faq-warning': true,
    'faq-monitoring-not-connected': true,
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(FAQ_ITEMS.map((f) => f.category)))];

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredFaqs = FAQ_ITEMS.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const query = searchFilter.toLowerCase().trim();
    if (!query) return matchesCategory;

    const matchesQuery =
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query) ||
      item.tags.some((t) => t.toLowerCase().includes(query));

    return matchesCategory && matchesQuery;
  });

  return (
    <section id="sec-faq" className="bg-surface-container-lowest rounded-xl p-unit-lg shadow-micro border border-outline-variant/30 scroll-mt-20 flex flex-col gap-unit-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-unit-sm border-b border-surface-container-low">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-primary">
              quiz
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
              Knowledge Base &amp; FAQ
            </h3>
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-unit-2xs">
            Frequently asked questions across portfolio management, status rules, pricing, and topology.
          </p>
        </div>
        <span className="font-caption-xs text-caption-xs px-2 py-1 rounded bg-surface-container text-secondary font-label-mono shrink-0 mt-2 sm:mt-0">
          {filteredFaqs.length} OF {FAQ_ITEMS.length} TOPICS
        </span>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-lg font-label-md text-label-md transition-colors cursor-pointer border ${
              selectedCategory === cat
                ? 'bg-primary text-on-primary font-semibold border-primary shadow-micro'
                : 'bg-surface-container-low text-secondary border-outline-variant/30 hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* FAQ Accordion List */}
      <div className="flex flex-col gap-unit-xs mt-unit-xs">
        {filteredFaqs.length === 0 ? (
          <div className="p-unit-lg text-center rounded-xl bg-surface-container-low border border-outline-variant/30 flex flex-col items-center gap-2">
            <span className="material-symbols-outlined text-[28px] text-secondary">
              search_off
            </span>
            <p className="font-body-sm text-body-sm text-secondary">
              No help topics match your current search criteria.
            </p>
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isOpen = !!openFaqIds[faq.id];
            return (
              <div
                key={faq.id}
                className="rounded-xl bg-surface-container-low border border-outline-variant/30 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full py-unit-sm px-unit-md flex items-center justify-between text-left hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <span className="font-label-md text-[14px] text-on-surface font-semibold truncate">
                      {faq.question}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden md:inline-flex font-caption-xs text-caption-xs px-2 py-0.5 rounded bg-surface-container text-secondary font-mono">
                      {faq.category}
                    </span>
                    <span
                      className={`material-symbols-outlined text-secondary text-[20px] transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-primary' : ''
                      }`}
                    >
                      expand_more
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-unit-md pb-unit-md pt-unit-2xs border-t border-surface-container-high/60">
                    <p className="font-body-sm text-body-sm text-secondary leading-relaxed">
                      {faq.answer}
                    </p>
                    {faq.tags && faq.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-unit-sm pt-unit-2xs">
                        <span className="font-caption-xs text-caption-xs text-outline">Tags:</span>
                        {faq.tags.map((t) => (
                          <span
                            key={t}
                            className="font-caption-xs text-caption-xs px-1.5 py-0.5 rounded bg-surface-container text-secondary font-mono"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
