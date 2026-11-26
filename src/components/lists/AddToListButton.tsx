"use client";

/**
 * CONTRACT: <AddToListButton bookId title /> – opens a popover to add the book to one of the user's lists
 * (or create a new list). Implementation owned by the accounts & lists workstream.
 */
export function AddToListButton({ bookId, title, className = "" }: { bookId: string; title: string; className?: string }) {
  void bookId;
  return (
    <button type="button" className={`btn btn-outline ${className}`} aria-label={`Add ${title} to a list`}>
      + Add to list
    </button>
  );
}
