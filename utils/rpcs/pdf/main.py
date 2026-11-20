import math
import re
import logging
import socketio
import pymupdf
import json
from datetime import datetime, timezone

from Metadata import to_pdf_datetime

__author__ = "Karim Ouf"

def tag_color_to_rgb(hex_color):
    """
    Converts a tag's hex color to the RGB tuple pymupdf expects.
    The backend resolves it from the shared tag-colors module (utils/modules/tag-colors).
    Args:
        hex_color: Hex color without "#" (e.g. "009933"), or None.
    Returns:
        RGB tuple with values in 0..1; yellow when no color is given.
    """
    if not hex_color:
        return (1, 1, 0)
    return tuple(int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4))

def create_app():
    """
    Creates and configures the Socket.IO WSGI application for PDF annotation processing.
    Sets up event handlers for connecting, calling, testing, extracting/removing annotations, embedding annotations, and deleting all annotations in PDF files.
    Returns:
        The configured WSGI application.
    """
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    # Default is 1 MB; CARE's webserver already allows 100 MB for the same PDFs.
    sio = socketio.Server(async_mode='threading', max_http_buffer_size=100_000_000)

    @sio.event
    def connect(sid, environ, auth):
        """
        Handles a new Socket.IO connection event.
        Args:
            sid: Session ID.
            environ: WSGI environment.
            auth: Authentication data.
        """
        logger.info(f"Connection established with {sid}")

    @sio.on("healthy")
    def healthy(sid, data):
        """
        Liveness probe. Reports that the PDF RPC process is up and responsive.
        """
        logger.info(f"Health check from {sid}")
        try:
            return {"success": True, "data": {"status": "ok"}}
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return {"success": False, "message": str(e)}

    @sio.on("test")
    def test(sid, data):
        """
        Handles a 'test' event to open a PDF file for reading.
        Args:
            sid: Session ID.
            data: Contains the PDF file and document hash.
        Returns:
            Success or error message after reading the PDF.
        """
        logger.info(f"Received call: {data} from {sid}")
        try:
            doc = pymupdf.open(stream=data["file"])
            response = {"success": True, "message": "PDF read successfully"}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    @sio.on("annotationsExtract")
    def extract_pdf_annotations(sid, data):
        """
        Extracts all annotations from a PDF, groups them by subject (unless title is empty), and removes them from the document.
        Returns:
            {
                "success": True/False,
                "message": "...",
                "data": {
                    "annotations": [...],
                    "wholeText": ...,
                    "file": ...,
                }
            }
        """
        try:
            doc = pymupdf.open(stream=data["file"])
            whole_text = ""
            grouped_annotations = {}
            annotations_order = []
            annotations = []

            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                whole_text += page_text

                annots = list(page.annots() or [])

                for annot in annots:
                    subject = annot.info.get("subject", "default")
                    title = annot.info.get("title")

                    words_on_page = page.get_text("words")
                    is_care = bool(subject and subject.strip().startswith("$$"))
                    # Comment icons hold author names as lines; drop them along with the highlight's author
                    authors = care_comment_authors(doc, annot, title or grouped_annotations.get(subject, {}).get("author")) if is_care else set()
                    comment = extract_comment(annot.info.get("content", ""), authors)
                    highlighted_text = extract_annot(annot, words_on_page)     
                    # Skip comment annotations and add comment to grouped annotations
                    if len(highlighted_text) == 0:
                        # If this is a care annotation, try to add comment to existing group
                        if subject and subject.strip().startswith("$$") and comment:
                            if subject in grouped_annotations:
                                grouped_annotations[subject]["comment"] += f"{comment} "
                        continue

                    rect = list(annot.rect)
                    annot_text = annot.get_text("text")
                    start_idx = page_text.find(annot_text)
                    end_idx = start_idx + len(annot_text) if start_idx != -1 else -1

                    text_start = start_idx if start_idx != -1 else 0
                    text_end = end_idx if end_idx != -1 else 0
                    prefix = whole_text[max(0, text_start - 30):text_start]
                    suffix = whole_text[text_end:text_end + 30]

                    # If annotation is not made by care (no grouping subject),
                    if not (subject and subject.strip().startswith("$$")):
                        annotations.append({
                            "page": page.number,
                            "type": annot.type[1] if isinstance(annot.type, tuple) else annot.type,
                            "rects": [rect],
                            "comment": comment.strip(),
                            "texts": [highlighted_text],
                            "color": annot.colors,
                            "prefix": prefix,
                            "suffix": suffix,
                            "subject": subject,
                            "text": highlighted_text,
                        })
                        # Remove annotation from the page
                        annot.update(fill_color=(0, 0, 0))
                        page.delete_annot(annot)
                        continue

                    # Grouped annotation logic
                    if subject not in grouped_annotations:
                        grouped_annotations[subject] = {
                            "page": page.number,
                            "type": annot.type[1] if isinstance(annot.type, tuple) else annot.type,
                            "rects": [],
                            "comment": "",
                            "texts": [],
                            "color": annot.colors,
                            "text_start": None,
                            "text_end": None,
                            "author": title,
                        }
                        annotations_order.append(subject)

                    grouped = grouped_annotations[subject]

                    if comment:
                        grouped["comment"] += f"{comment} "
                    grouped["texts"].append(highlighted_text)
                    grouped["rects"].append(rect)

                    if start_idx != -1:
                        if grouped["text_start"] is None or start_idx < grouped["text_start"]:
                            grouped["text_start"] = start_idx
                        if grouped["text_end"] is None or end_idx > grouped["text_end"]:
                            grouped["text_end"] = end_idx
            # Add grouped annotations to the result
            for subject in annotations_order:
                group = grouped_annotations[subject]
                texts = group.get("texts") or []
                full_text = " ".join(texts).strip() if len(texts) != 0 else ""
                text_start = group.get("text_start") or 0
                text_end = group.get("text_end") or 0
                prefix = whole_text[max(0, text_start - 30):text_start]
                suffix = whole_text[text_end:text_end + 30]

                annotations.append({
                    "page": group["page"],
                    "type": group["type"],
                    "rects": group["rects"],
                    "comment": group["comment"].strip(),
                    "text": full_text,
                    "color": group["color"],
                    "prefix": prefix,
                    "suffix": suffix,
                    "subject": subject,
                })

            doc.write()
            return {
                "success": True,
                "message": "Annotations extracted successfully.",
                "data": {
                    "annotations": annotations,
                    "wholeText": whole_text,
                }
            }

        except Exception as e:
            logger.error(f"[extract_pdf_annotations] Error: {e}")
            return {"success": False, "message": "error: " + str(e)}
        
    @sio.on("embedAnnotations")
    def embeddAnnotations(sid, data):
        """
        Embeds new annotations and comments into a PDF file based on provided annotation data.
        Args:
            sid: Session ID.
            data: Contains the PDF file, document hash, and annotation details.
        Returns:
            The modified PDF file with embedded annotations, or the original if none provided.
        """
        try:
            # Open the PDF directly from memory
            doc = pymupdf.open(stream=data["file"])

            annotations = data.get("annotations", [])
            if not annotations:
                response = {"success": True, "message": "No annotations provided.", "data": data["file"]}
                return response
            subject = "care"
            i = 0
            for annot in annotations:
                # Extract page number from annotation selectors
                page_number = None
                selectors = annot.get("selectors", {})
                username = annot.get("username", "unknown") # Prefix username with $$ to indicate care annotation
                targets = selectors.get("target", [])
                text_start = None
                text_end = None
                textType = annot.get("tag")
                color = tag_color_to_rgb(annot.get("tagColor"))
                prefix = None
                exact = None
                suffix = None
                if targets and isinstance(targets, list):
                    for target in targets:
                        for selector in target.get("selector", []):
                            match selector.get("type"):
                                case "PagePositionSelector":
                                    page_number = selector.get("number")
                                case "TextPositionSelector":
                                    text_start = selector.get("start")
                                    text_end = selector.get("end")
                                case "TextQuoteSelector":
                                    prefix = selector.get("prefix")
                                    exact = selector.get("exact")
                                    suffix = selector.get("suffix")
                        if page_number is not None:
                            break
                full_rect = None
                if page_number is not None:
                    doc_page = doc[page_number-1]
                    selected_rect = get_best_exact_rect(doc_page, exact, prefix, suffix)
                    
                    if selected_rect is not None and not selected_rect.is_empty:
                        extracted_text = doc_page.get_textbox(selected_rect)
                        logger.warning(f"Extracted text '{extracted_text}' does not match expected text '{exact}'")
                        content, authors = comments_to_content(annot.get("comments", []), textType, username)
                        date = last_edited_pdf_date(annot)
                        add_annotations(doc_page, selected_rect, extracted_text, exact, color, "$$" + subject + str(i), username, content, authors, date)
                    else:
                        logger.warning("No suitable rect found for annotation.")
                i+=1        

            # Save the modified PDF to memory
            output_buffer = doc.write()
            response = {"success": True, "message": "PDF with annotations saved successfully", "data": output_buffer}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    @sio.on("deleteAllAnnotations")
    def delete_all_annotations(sid, data):
        """
        Removes all annotations from a PDF file and returns the cleaned file.
        Args:
            sid: Session ID.
            data: Contains the PDF file and document hash.
        Returns:
            The PDF file with all annotations removed.
        """
        logger.info(f"Received deleteAllAnnotations call: {data} from {sid}")
        try:
            doc = pymupdf.open(stream=data["file"])
            # Remove all annotations from all pages
            for page in doc:
                annots = [a for a in page.annots()]
                for annot in annots:
                    page.delete_annot(annot)
            # Get the modified PDF as a buffer
            output_buffer = doc.write()
            response = {
                "success": True,
                "message": "All annotations deleted successfully.",
                "data": {
                    "file": output_buffer
                }
            }
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    def search_with_reduction(doc_page, search_string, quads=False):
        """
        Searches for a string on the PDF page, reducing one character at a time from the end until a match is found.
        Args:
            doc_page: The PDF page object.
            search_string: The string to search for.
            quads: Whether to return quadrilaterals instead of rectangles.
        Returns:
            List of found rectangles (may be empty if nothing matches).
        """
        temp_string = search_string
        while temp_string:
            rects = doc_page.search_for(temp_string, quads=quads)
            if rects:
                return rects
            temp_string = temp_string[:-1]  # Remove one character from the end
        return []
    
    def get_best_exact_rect(doc_page, exact, prefix=None, suffix=None):
        """
        Finds the rectangle of the 'exact' string that is closest to the given prefix and suffix on the page.
        Args:
            doc_page: The PDF page object.
            exact: The exact string to find.
            prefix: Optional prefix string.
            suffix: Optional suffix string.
        Returns:
            The best matching rectangle or None if not found.
        """
        def rect_midpoint(rect):
            return ((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2)

        def distance(p1, p2):
            return math.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)

        prefix_rects = search_with_reduction(doc_page, prefix, quads=False) if prefix else []
        exact_rects = search_with_reduction(doc_page, exact, quads=False)
        suffix_rects = search_with_reduction(doc_page, suffix, quads=False) if suffix else []

        best_rect = None
        best_score = float('inf')

        for exact_rect in exact_rects:
            exact_mid = rect_midpoint(exact_rect)
            prefix_dist = min((distance(rect_midpoint(p), exact_mid) for p in prefix_rects), default=0)
            suffix_dist = min((distance(rect_midpoint(s), exact_mid) for s in suffix_rects), default=0)
            score = prefix_dist + suffix_dist
            if score < best_score:
                best_score = score
                best_rect = exact_rect

        return best_rect

    def add_highlight(doc_page, rects, color, subject, name, content, authors, date):
        """
        Adds one highlight annotation and, when it has a comment, a comment icon in the margin next to its first line.
        The comment lives only on the icon, so hovering the highlighted text shows nothing.
        Args:
            doc_page: The PDF page object.
            rects: A rectangle or a list of rectangles (one per line) to highlight.
            color: RGB tuple for the highlight color.
            subject: Grouping key ("$$care<n>") used to recognize CARE annotations on import.
            name: Author shown by PDF viewers.
            content: Comment text; empty for no comment.
            authors: Names used as lines in content, so the import can remove them.
            date: PDF date string ("D:...") shown by viewers.
        """
        annot = doc_page.add_highlight_annot(rects)
        annot.set_colors(stroke=color)
        annot.set_info({"title": name, "subject": subject, "modDate": date, "creationDate": date})
        annot.update()
        if content:
            first = rects[0] if isinstance(rects, list) else rects
            add_comment_icon(doc_page, margin_icon_position(doc_page, first), color, subject, content, authors, date)

    _icon_size = 16  # PyMuPDF's text annotation icon is 16x16 points
    _icon_gap = 4

    def margin_icon_position(doc_page, line_rect):
        """
        Returns the top-left point for a comment icon in the outer margin of the text column holding line_rect,
        so the icon covers no text: left of a column in the left half of the page, right of one in the right half.
        Viewers like Chrome and Firefox can't move annotations, so the icon has to start somewhere readable.
        Args:
            doc_page: The PDF page object.
            line_rect: Rectangle of the highlight's first line.
        Returns:
            The (x, y) top-left point, aligned with the top of the line.
        """
        center = (line_rect.tl + line_rect.br) / 2
        column = line_rect
        for x0, y0, x1, y1, *_ in doc_page.get_text("blocks"):
            if pymupdf.Rect(x0, y0, x1, y1).contains(center):
                column = pymupdf.Rect(x0, y0, x1, y1)
                break
        page = doc_page.rect
        if (column.x0 + column.x1) / 2 <= page.width / 2:
            x = column.x0 - _icon_gap - _icon_size
        else:
            x = column.x1 + _icon_gap
        x = min(max(x, 0), page.width - _icon_size)
        return (x, line_rect.y0)

    def add_comment_icon(doc_page, position, color, subject, content, authors, date):
        """
        Adds a comment icon (text annotation) without a linked popup.
        Firefox draws its own comment button next to annotations with a popup, which would show two icons.
        Args:
            doc_page: The PDF page object.
            position: Top-left point of the icon.
            color: RGB tuple for the icon color.
            subject: Grouping key ("$$care<n>"); the import adds the comment to the highlight with this key.
            content: Comment text, with each author's name on its own line.
            authors: Those names; stored under a key viewers ignore, so the import can remove the name lines.
            date: PDF date string ("D:..."); without it Firefox shows 1 January 1970.
        """
        note = doc_page.add_text_annot(position, content, icon="Comment")
        # Highlights starting on the same line would stack their icons; move down the margin until free.
        others = [a.rect for a in doc_page.annots(types=[pymupdf.PDF_ANNOT_TEXT]) if a.xref != note.xref]
        r = note.rect
        while any(r.intersects(o) for o in others):
            r = pymupdf.Rect(r.x0, r.y0 + r.height + 2, r.x1, r.y1 + r.height + 2)
        note.set_rect(r)
        # No author field: the names are already in the text, and Chrome would show the first one twice
        note.set_info({"subject": subject, "modDate": date, "creationDate": date})
        note.set_colors(stroke=color)
        note.update()
        doc = doc_page.parent
        doc.xref_set_key(note.xref, "CAREAuthors", pymupdf.get_pdf_str(json.dumps(authors)))
        popup_key = doc.xref_get_key(note.xref, "Popup")
        if popup_key[0] == "xref":
            popup_ref = popup_key[1]
            doc.xref_set_key(note.xref, "Popup", "null")
            annots = doc.xref_get_key(doc_page.xref, "Annots")
            if annots[0] == "array":
                refs = re.findall(r"\d+ \d+ R", annots[1])
                doc.xref_set_key(doc_page.xref, "Annots", "[" + " ".join(r for r in refs if r != popup_ref) + "]")

    def add_annotations(doc_page, selected_rect, extracted_text, original_text, color, subject, name, content, authors, date):
        """
        Expands the selected rectangle forward word by word until it covers as many words as in the original_text, then highlights them as one annotation with one box per line.
        Args:
            doc_page: The PDF page object.
            selected_rect: The initial rectangle to start highlighting from.
            extracted_text: The text extracted from the selected rectangle.
            original_text: The full text to highlight.
            color: RGB tuple for the highlight color.
            subject: Grouping key ("$$care<n>") used to recognize CARE annotations on import.
            name: Author shown by PDF viewers.
            content: Comment text for the comment icon; empty for no comment.
            authors: Names used as lines in content.
            date: PDF date string ("D:...") shown by viewers.
        Returns:
            A new rectangle covering the highlighted area.
        """

            # First, check if the selected_rect's text matches the original_text
        selected_text = doc_page.get_textbox(selected_rect).strip()

        if selected_text == original_text.strip():
            add_highlight(doc_page, selected_rect, color, subject, name, content, authors, date)
            return selected_rect

        words = doc_page.get_text("words")  # Each word: (x0, y0, x1, y1, "word", block_no, line_no, word_no)

        found = False
        result_text = extracted_text
        rects = [selected_rect]
        original_text_length = len(original_text.strip().split(" ")) if original_text else 0
        
        splits = original_text.strip().split(" ")
        highlighted_count = 0
        # One box per text line; separate per-word highlights render as gaps between words.
        line_rects = {}

        for i, word in enumerate(words):
            x0, y0, x1, y1, text, block_no, line_no, *_ = word
            word_rect = pymupdf.Rect(x0, y0, x1, y1)
            if found:
                if highlighted_count >= original_text_length - 1:
                    break
                result_text += (" " if not result_text.endswith(" ") else "") + text
                rects.append(word_rect)
                line_rects[(block_no, line_no)] = line_rects.get((block_no, line_no), word_rect) | word_rect
                highlighted_count += 1
            elif word_rect.intersects(selected_rect):
                found = True
                line_rects[(block_no, line_no)] = word_rect

        if line_rects:
            add_highlight(doc_page, list(line_rects.values()), color, subject, name, content, authors, date)

        # If no words highlighted, just return the selected_rect
        if len(rects) == 1:
            logger.warning("No additional words highlighted, returning selected_rect")
            return selected_rect

        # Return the union of all collected rects
        union_rect = rects[0]
        for r in rects[1:]:
            union_rect |= r
        return union_rect
    
    def comments_to_content(comments, textType, author):
        """
        Builds the text stored on a comment icon: each comment as a "<tag>: <comment>" line, preceded by its
        author's name whenever the author changes (a thread can hold replies by other users).
        Names are part of the text because Firefox's comment popup shows only the date and the text.
        Args:
            comments: List of comment dicts with 'text' and, from the backend, 'username'.
            textType: The tag name, or None.
            author: The annotation author, used for comments without a username.
        Returns:
            (content, authors): the content string (empty when there are no comments) and the names used as lines.
        """
        lines = []
        authors = []
        for comment in comments:
            if comment.get("text") is None:
                continue
            comment_name = comment.get("username", author)
            if not authors or authors[-1] != comment_name:
                lines.append(comment_name)
                authors.append(comment_name)
            lines.append(f"{textType}: {comment['text']}" if textType else comment["text"])
        return "\n".join(lines), sorted(set(authors))

    def last_edited_pdf_date(annot):
        """
        Returns the newest updatedAt of an annotation and its comments as a PDF date string.
        Args:
            annot: Annotation dict from the backend; dates arrive as ISO strings.
        Returns:
            A string like "D:20261103101500+00'00'"; the current time if no date is available,
            since Firefox shows 1 January 1970 for an icon without a date.
        """
        dates = []
        for item in [annot, *annot.get("comments", [])]:
            value = item.get("updatedAt") or item.get("createdAt")
            if isinstance(value, str):
                try:
                    dates.append(datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc))
                except ValueError:
                    pass
        return to_pdf_datetime(max(dates) if dates else datetime.now(timezone.utc))

    _threshold_intersection = 0.01  # if the intersection is large enough.

    def check_contain(r_word, points):
        """
        Checks if a word rectangle is contained in the given highlight area.
        The area of the intersection should be large enough compared to the area of the word.
        Args:
            r_word: pymupdf.Rect of a single word.
            points: List of points in the highlight area.
        Returns:
            bool: Whether the word is contained in the highlight area.
        """
        r = pymupdf.Quad(points).rect
        r.intersect(r_word)

        if r.get_area("cm") >= r_word.get_area("cm") * _threshold_intersection:
            contain = True
        else:
            contain = False
        return contain
    def care_comment_authors(doc, annot, highlight_author):
        """
        Collects the author names the export wrote as lines into a CARE comment icon.
        Args:
            doc: The PDF document.
            annot: The annotation being imported.
            highlight_author: Author of the CARE highlight; earlier exports wrote only this name, as the first line.
        Returns:
            Set of names to remove from the comment text.
        """
        authors = {highlight_author.strip()} if highlight_author else set()
        stored = doc.xref_get_key(annot.xref, "CAREAuthors")
        if stored[0] == "string":
            try:
                authors.update(name.strip() for name in json.loads(stored[1]))
            except (ValueError, AttributeError):
                logger.warning(f"Unreadable CAREAuthors on annotation {annot.xref}")
        return authors

    def extract_comment(comment, authors=()):
        """
        Extracts the comment text from the annotation info and removes specific prefixes.
        Args:
            comment: The comment string from the annotation info.
            authors: For CARE annotations, author names the export wrote as lines; those lines are removed.
        Returns:
            The cleaned comment string with prefixes removed.
        """
        if not comment:
            return ""

        comment = "\n".join(line for line in comment.splitlines() if line.strip() not in authors)

        # Remove specific prefixes; a highlight stores one "<tag>: <comment>" line per comment
        prefixes_to_remove = ["Highlight:", "Strength:", "Weakness:", "Other:"]

        cleaned_lines = []
        for line in comment.splitlines():
            # Clean up the line by removing extra spaces
            cleaned_line = ' '.join(line.split())
            for prefix in prefixes_to_remove:
                if cleaned_line.startswith(prefix):
                    # Remove the prefix and any following whitespace
                    cleaned_line = cleaned_line[len(prefix):].strip()
                    break
            if cleaned_line:
                cleaned_lines.append(cleaned_line)

        return ' '.join(cleaned_lines)

    def extract_annot(annot, words_on_page):
        """
        Extracts the words in a given highlight annotation.
        Args:
            annot: The annotation object.
            words_on_page: List of words on the page.
        Returns:
            String of words in the entire highlight.
        """
        quad_points = annot.vertices
        if not quad_points:
            logger.warning(f"no quad points")
            return []
        quad_count = int(len(quad_points) / 4)
        sentences = ['' for i in range(quad_count)]
        for i in range(quad_count):
            points = quad_points[i * 4: i * 4 + 4]
            words = [
                w for w in words_on_page if
                check_contain(pymupdf.Rect(w[:4]), points)
            ]
            sentences[i] = ' '.join(w[4] for w in words)
        sentence = ' '.join(sentences)

        return sentence
    
    logger.info("Creating App...")
    app = socketio.WSGIApp(sio)
    return app