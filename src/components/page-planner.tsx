"use client";
import type { PortfolioDocument } from "@/modules/portfolios/schema";
import {
  pageDefaults,
  portfolioPages,
  type PageDestination,
} from "@/modules/portfolios/structure";
import { Field } from "./ui";
export function PagePlanner({
  document,
  onChange,
}: {
  document: PortfolioDocument;
  onChange: (doc: PortfolioDocument) => void;
}) {
  const navigation = document.navigation;
  const plan = portfolioPages({
    ...document,
    navigation: { ...navigation, layout: "pages" },
  });
  function update(values: Partial<PortfolioDocument["navigation"]>) {
    onChange({ ...document, navigation: { ...navigation, ...values } });
  }
  return (
    <section className="panel page-planner">
      <p className="eyebrow">A clear path through their work</p>
      <h2>Website structure</h2>
      <p className="panel-description">
        Give visitors focused pages for the researcher, their work, and getting
        in touch. Place individual sections from Academic sections.
      </p>
      <div className="form-grid">
        <Field label="Section sequence">
          <select
            value={navigation.sectionOrder || "academic"}
            onChange={(e) =>
              update({ sectionOrder: e.target.value as "academic" | "manual" })
            }
          >
            <option value="academic">
              Academic order — education before interests
            </option>
            <option value="manual">My custom order</option>
          </select>
        </Field>
        <Field label="Home menu label">
          <input
            value={navigation.homeLabel ?? "Home"}
            maxLength={200}
            onChange={(e) => update({ homeLabel: e.target.value })}
          />
        </Field>
        <Field label="Mobile menu label">
          <input
            value={navigation.menuLabel ?? "Menu"}
            maxLength={200}
            onChange={(e) => update({ menuLabel: e.target.value })}
          />
        </Field>
      </div>
      {
        <div className="page-plan-grid">
          {(Object.keys(pageDefaults) as PageDestination[]).map(
            (key, index) => {
              const setting = {
                ...pageDefaults[key],
                ...navigation.pageSettings?.[key],
              };
              const page = plan.pages.find((p) => p.slug === setting.slug);
              const count = page?.sections.filter((s) => s.visible).length || 0;
              const edit = (values: Partial<typeof setting>) =>
                update({
                  pageSettings: {
                    ...navigation.pageSettings,
                    [key]: { ...setting, ...values },
                  },
                });
              return (
                <div className="page-plan-card" key={key}>
                  <div className="spread">
                    <span className="page-plan-number">0{index + 1}</span>
                    <span className="section-type">
                      {page
                        ? `${count} section${count === 1 ? "" : "s"}`
                        : "Appears when content is added"}
                    </span>
                  </div>
                  <Field label={`${pageDefaults[key].title} page title`}>
                    <input
                      value={setting.title}
                      maxLength={200}
                      onChange={(e) => edit({ title: e.target.value })}
                    />
                  </Field>
                  <Field
                    label={`${pageDefaults[key].title} page address`}
                    hint="Lowercase letters, numbers, and hyphens."
                  >
                    <input
                      value={setting.slug}
                      maxLength={80}
                      onChange={(e) => edit({ slug: e.target.value })}
                    />
                  </Field>
                  <Field label={`${pageDefaults[key].title} introduction`}>
                    <textarea
                      rows={2}
                      value={setting.description}
                      maxLength={320}
                      onChange={(e) => edit({ description: e.target.value })}
                    />
                  </Field>
                </div>
              );
            },
          )}
        </div>
      }
      <p className="panel-description" style={{ margin: "20px 0 0" }}>
        Existing content is preserved when you switch layouts. Custom pages
        below join the menu; a custom page with the same address adds its
        sections to that page.
      </p>
    </section>
  );
}
