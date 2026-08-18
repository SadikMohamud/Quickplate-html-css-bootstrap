"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import { loadMenu, priceLabel } from "@/lib/menu";
import { getBrowserClient } from "@/lib/supabase/client";
import type { MenuItem, MenuSection, MenuVariant } from "@/lib/types";

// The whole menu, editable by the owner with no developer involved:
// categories, dishes and the variants that price the same dish by format.

type Table = "menu_categories" | "menu_items" | "menu_variants";

const inputClasses =
  "w-full rounded-xl border border-brand-accent/40 px-3 py-2 text-sm outline-none focus:border-brand-accent";
const smallButton =
  "rounded-lg border border-brand-accent/40 px-2 py-1 text-xs disabled:opacity-40";

export default function MenuEditor() {
  const [sections, setSections] = useState<MenuSection[]>([]);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const load = useCallback(async () => {
    try {
      setSections(await loadMenu(getBrowserClient()));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the menu.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // load is async, so its state updates land in later microtasks.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Every write goes through here so one place handles the busy flag,
  // errors and the reload.
  // PromiseLike, not Promise: Supabase query builders are thenables that
  // only run when awaited.
  const run = useCallback(
    async (work: () => PromiseLike<{ error: { message: string } | null }>) => {
      setBusy(true);
      setError(null);
      const { error: err } = await work();
      setBusy(false);
      if (err) setError(err.message);
      else await load();
    },
    [load]
  );

  const update = useCallback(
    (table: Table, id: string, patch: Record<string, unknown>) =>
      run(() => getBrowserClient().from(table).update(patch).eq("id", id)),
    [run]
  );

  const remove = useCallback(
    (table: Table, id: string) =>
      run(() => getBrowserClient().from(table).delete().eq("id", id)),
    [run]
  );

  // Reordering swaps this row's position with its neighbour, so the list
  // stays a simple ordered sequence with no gaps to manage.
  const swap = useCallback(
    async (
      table: Table,
      rows: { id: string; sort_order: number }[],
      index: number,
      direction: -1 | 1
    ) => {
      const other = index + direction;
      if (other < 0 || other >= rows.length) return;
      const a = rows[index];
      const b = rows[other];
      setBusy(true);
      setError(null);
      const supabase = getBrowserClient();
      const first = await supabase
        .from(table)
        .update({ sort_order: b.sort_order })
        .eq("id", a.id);
      const second = await supabase
        .from(table)
        .update({ sort_order: a.sort_order })
        .eq("id", b.id);
      setBusy(false);
      const err = first.error ?? second.error;
      if (err) setError(err.message);
      else await load();
    },
    [load]
  );

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    const nextOrder =
      sections.reduce((max, s) => Math.max(max, s.sort_order), 0) + 1;
    setNewCategory("");
    await run(() =>
      getBrowserClient()
        .from("menu_categories")
        .insert({ name, sort_order: nextOrder })
    );
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 pb-28 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Menu</h1>
            <p className="text-xs text-brand-muted">
              Categories, dishes, prices and variants
            </p>
          </div>
          <Link
            href="/owner"
            className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand"
          >
            Dashboard
          </Link>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-brand-muted">
            Loading...
          </div>
        ) : (
          <>
            {sections.map((section, index) => (
              <CategoryCard
                key={section.id}
                section={section}
                open={openCategory === section.id}
                busy={busy}
                onToggle={() =>
                  setOpenCategory(openCategory === section.id ? null : section.id)
                }
                onMove={(direction) =>
                  swap("menu_categories", sections, index, direction)
                }
                onUpdate={(patch) => update("menu_categories", section.id, patch)}
                onDelete={() => remove("menu_categories", section.id)}
                onItemUpdate={(id, patch) => update("menu_items", id, patch)}
                onItemDelete={(id) => remove("menu_items", id)}
                onItemMove={(itemIndex, direction) =>
                  swap("menu_items", section.items, itemIndex, direction)
                }
                onVariantUpdate={(id, patch) =>
                  update("menu_variants", id, patch)
                }
                onVariantDelete={(id) => remove("menu_variants", id)}
                run={run}
              />
            ))}

            <form
              onSubmit={addCategory}
              className="flex gap-2 rounded-3xl bg-brand-surface p-4 shadow-sm"
            >
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="New category"
                aria-label="New category"
                className={inputClasses}
              />
              <button
                type="submit"
                disabled={busy}
                className="shrink-0 rounded-xl border border-brand px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Add
              </button>
            </form>
          </>
        )}

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
      <BottomNav role="owner" />
    </>
  );
}

type Run = (
  work: () => PromiseLike<{ error: { message: string } | null }>
) => Promise<void>;

function CategoryCard({
  section,
  open,
  busy,
  onToggle,
  onMove,
  onUpdate,
  onDelete,
  onItemUpdate,
  onItemDelete,
  onItemMove,
  onVariantUpdate,
  onVariantDelete,
  run,
}: {
  section: MenuSection;
  open: boolean;
  busy: boolean;
  onToggle: () => void;
  onMove: (direction: -1 | 1) => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onItemUpdate: (id: string, patch: Record<string, unknown>) => void;
  onItemDelete: (id: string) => void;
  onItemMove: (index: number, direction: -1 | 1) => void;
  onVariantUpdate: (id: string, patch: Record<string, unknown>) => void;
  onVariantDelete: (id: string) => void;
  run: Run;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(section.name);
  const [newItem, setNewItem] = useState("");

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const value = newItem.trim();
    if (!value) return;
    const nextOrder =
      section.items.reduce((max, i) => Math.max(max, i.sort_order), 0) + 1;
    setNewItem("");
    await run(() =>
      getBrowserClient()
        .from("menu_items")
        .insert({
          category_id: section.id,
          name: value,
          sort_order: nextOrder,
        })
    );
  }

  return (
    <section className="rounded-3xl bg-brand-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {renaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setRenaming(false);
              if (name.trim() && name.trim() !== section.name) {
                onUpdate({ name: name.trim() });
              }
            }}
            className="flex min-w-0 flex-1 gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="Category name"
              className={inputClasses}
              autoFocus
            />
            <button type="submit" className={smallButton}>
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="truncate font-semibold">{section.name}</span>
            <span className="shrink-0 text-xs text-brand-muted">
              {section.items.length}
            </span>
            {!section.is_visible && (
              <span className="shrink-0 rounded-full bg-brand-muted/15 px-2 py-0.5 text-[0.65rem] text-brand-muted">
                Hidden
              </span>
            )}
          </button>
        )}

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Move category up"
            onClick={() => onMove(-1)}
            disabled={busy}
            className={smallButton}
          >
            &uarr;
          </button>
          <button
            type="button"
            aria-label="Move category down"
            onClick={() => onMove(1)}
            disabled={busy}
            className={smallButton}
          >
            &darr;
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRenaming(!renaming)}
              className={smallButton}
            >
              {renaming ? "Cancel" : "Rename"}
            </button>
            <button
              type="button"
              onClick={() => onUpdate({ is_visible: !section.is_visible })}
              disabled={busy}
              className={smallButton}
            >
              {section.is_visible ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
            >
              Delete category
            </button>
          </div>

          <ul className="flex flex-col gap-3">
            {section.items.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                busy={busy}
                onMove={(direction) => onItemMove(index, direction)}
                onUpdate={(patch) => onItemUpdate(item.id, patch)}
                onDelete={() => onItemDelete(item.id)}
                onVariantUpdate={onVariantUpdate}
                onVariantDelete={onVariantDelete}
                run={run}
              />
            ))}
          </ul>

          <form onSubmit={addItem} className="flex gap-2">
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="New dish"
              aria-label="New dish"
              className={inputClasses}
            />
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-xl border border-brand px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function ItemRow({
  item,
  busy,
  onMove,
  onUpdate,
  onDelete,
  onVariantUpdate,
  onVariantDelete,
  run,
}: {
  item: MenuItem;
  busy: boolean;
  onMove: (direction: -1 | 1) => void;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onVariantUpdate: (id: string, patch: Record<string, unknown>) => void;
  onVariantDelete: (id: string) => void;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description ?? "");
  const [basePrice, setBasePrice] = useState(
    item.base_price === null ? "" : item.base_price.toFixed(2)
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmedPrice = basePrice.trim();
    const parsed = trimmedPrice === "" ? null : Number(trimmedPrice);
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) return;
    setEditing(false);
    onUpdate({
      name: name.trim() || item.name,
      description: description.trim() || null,
      base_price: parsed,
    });
  }

  return (
    <li className="rounded-2xl bg-brand-accent/8 p-3">
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Dish name"
            className={inputClasses}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            aria-label="Description"
            className={inputClasses}
          />
          <input
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            inputMode="decimal"
            placeholder="Price, leave empty when the dish has variants"
            aria-label="Price"
            className={inputClasses}
          />
          <div className="flex gap-2">
            <button type="submit" className={smallButton}>
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={smallButton}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              {item.name}
              {!item.is_available && (
                <span className="ml-2 rounded-full bg-brand-muted/15 px-2 py-0.5 text-[0.65rem] text-brand-muted">
                  Off
                </span>
              )}
            </p>
            {item.description && (
              <p className="mt-0.5 text-sm text-brand-muted">
                {item.description}
              </p>
            )}
          </div>
          <span className="shrink-0 text-sm font-medium text-brand">
            {priceLabel(item)}
          </span>
        </div>
      )}

      <Variants
        item={item}
        busy={busy}
        onVariantUpdate={onVariantUpdate}
        onVariantDelete={onVariantDelete}
        run={run}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className={smallButton}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ is_available: !item.is_available })}
          disabled={busy}
          className={smallButton}
        >
          {item.is_available ? "Mark off" : "Mark on"}
        </button>
        <button
          type="button"
          aria-label="Move dish up"
          onClick={() => onMove(-1)}
          disabled={busy}
          className={smallButton}
        >
          &uarr;
        </button>
        <button
          type="button"
          aria-label="Move dish down"
          onClick={() => onMove(1)}
          disabled={busy}
          className={smallButton}
        >
          &darr;
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

// Variants price the same dish by format: Chicken Shawarma is 7.90 as a
// wrap and 12.90 as a box. One dish, two rows, never two dishes.
function Variants({
  item,
  busy,
  onVariantUpdate,
  onVariantDelete,
  run,
}: {
  item: MenuItem;
  busy: boolean;
  onVariantUpdate: (id: string, patch: Record<string, unknown>) => void;
  onVariantDelete: (id: string) => void;
  run: Run;
}) {
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    const parsed = Number(price);
    if (!trimmed || Number.isNaN(parsed) || parsed < 0) return;
    const nextOrder =
      item.variants.reduce((max, v) => Math.max(max, v.sort_order), 0) + 1;
    setLabel("");
    setPrice("");
    await run(() =>
      getBrowserClient().from("menu_variants").insert({
        item_id: item.id,
        label: trimmed,
        price: parsed,
        sort_order: nextOrder,
      })
    );
  }

  return (
    <div className="mt-2 border-t border-brand-accent/20 pt-2">
      {item.variants.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {item.variants.map((variant) => (
            <VariantRow
              key={variant.id}
              variant={variant}
              busy={busy}
              onUpdate={(patch) => onVariantUpdate(variant.id, patch)}
              onDelete={() => onVariantDelete(variant.id)}
            />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Wrap"
          aria-label="Variant name"
          className="min-w-0 flex-1 rounded-lg border border-brand-accent/40 px-2 py-1.5 text-xs outline-none focus:border-brand-accent"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          inputMode="decimal"
          placeholder="7.90"
          aria-label="Variant price"
          className="w-20 rounded-lg border border-brand-accent/40 px-2 py-1.5 text-xs outline-none focus:border-brand-accent"
        />
        <button type="submit" disabled={busy} className={smallButton}>
          Add
        </button>
      </form>
    </div>
  );
}

function VariantRow({
  variant,
  busy,
  onUpdate,
  onDelete,
}: {
  variant: MenuVariant;
  busy: boolean;
  onUpdate: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const [price, setPrice] = useState(variant.price.toFixed(2));

  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(price);
    if (Number.isNaN(parsed) || parsed < 0) return;
    if (parsed !== variant.price) onUpdate({ price: parsed });
  }

  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate">
        {variant.label}
        {!variant.is_available && (
          <span className="ml-2 text-brand-muted">off</span>
        )}
      </span>
      <form onSubmit={save} className="flex items-center gap-1">
        <span className="text-brand-muted">£</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={save}
          inputMode="decimal"
          aria-label={`Price of ${variant.label}`}
          className="w-16 rounded-lg border border-brand-accent/40 px-2 py-1 text-xs outline-none focus:border-brand-accent"
        />
      </form>
      <button
        type="button"
        onClick={() => onUpdate({ is_available: !variant.is_available })}
        disabled={busy}
        className={smallButton}
      >
        {variant.is_available ? "Off" : "On"}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 disabled:opacity-40"
      >
        &times;
      </button>
    </li>
  );
}
