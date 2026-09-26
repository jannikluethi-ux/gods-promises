"""Shared entry constructor for catalog modules."""

def e(book, chapter, verse_start, verse_end, promise, context, themes, feelings, search_terms=None, **kwargs):
    return {
        "book": book,
        "chapter": chapter,
        "verseStart": verse_start,
        "verseEnd": verse_end,
        "promise": promise,
        "context": context,
        "themes": themes,
        "feelings": feelings,
        "searchTerms": list(search_terms or []),
        **kwargs,
    }
