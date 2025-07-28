import math
import logging
import socketio
import pymupdf
import json

__author__ = "Karim Ouf"

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

    sio = socketio.Server(async_mode='threading')

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

    @sio.on("call")
    def call(sid, data):
        """
        Handles a generic 'call' event for testing connectivity.
        Args:
            sid: Session ID.
            data: Incoming data.
        Returns:
            A simple hello world response.
        """
        logger.info(f"Received call: {data} from {sid}")
        try:
            response = {"success": True, "data": "Hello World!"}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

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
                    comment = extract_comment(annot.info.get("content", ""))
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
                        }
                        annotations_order.append(subject)

                    grouped = grouped_annotations[subject]

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
                color = (1, 1, 0)  # always yellow for highlight
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
                        add_comment(doc_page, (selected_rect.x0, selected_rect.y0), annot.get("comments", []), color, textType, "$$" + subject + str(i), username)
                        add_annotations(doc_page, selected_rect, extracted_text, exact, color, "$$" + subject + str(i), username)
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
    def add_annotations(doc_page, selected_rect, extracted_text, original_text, color, subject, name):
        """
        Expands the selected rectangle forward word by word, highlighting each word, and stops after highlighting as many words as in the original_text.
        Args:
            doc_page: The PDF page object.
            selected_rect: The initial rectangle to start highlighting from.
            extracted_text: The text extracted from the selected rectangle.
            original_text: The full text to highlight.
            color: RGB tuple for the highlight color.
        Returns:
            A new rectangle covering the highlighted area.
        """

            # First, check if the selected_rect's text matches the original_text
        selected_text = doc_page.get_textbox(selected_rect).strip()

        if selected_text == original_text.strip():
            annot = doc_page.add_highlight_annot(selected_rect)
            annot.set_colors(stroke=color)
            annot.set_info({"title": name, "subject": subject})
            annot.update()
            return selected_rect

        words = doc_page.get_text("words")  # Each word: (x0, y0, x1, y1, "word", block_no, line_no, word_no)

        found = False
        result_text = extracted_text
        rects = [selected_rect]
        original_text_length = len(original_text.strip().split(" ")) if original_text else 0
        
        splits = original_text.strip().split(" ")
        highlighted_count = 0

        for i, word in enumerate(words):
            x0, y0, x1, y1, text, *_ = word
            word_rect = pymupdf.Rect(x0, y0, x1, y1)
            if found:
                if highlighted_count >= original_text_length - 1:
                    break
                result_text += (" " if not result_text.endswith(" ") else "") + text
                rects.append(word_rect)
                # Highlight this word
                annot = doc_page.add_highlight_annot(word_rect)
                annot.set_colors(stroke=color)
                annot.set_info({"title": name, "subject": subject})
                annot.update()
                highlighted_count += 1
            elif word_rect.intersects(selected_rect):
                found = True
                # Optionally highlight the starting word as well
                annot = doc_page.add_highlight_annot(word_rect)
                annot.set_colors(stroke=color)
                annot.set_info({"title": name, "subject": subject})
                annot.update()

        # If no words highlighted, just return the selected_rect
        if len(rects) == 1:
            logger.warning("No additional words highlighted, returning selected_rect")
            return selected_rect

        # Return the union of all collected rects
        union_rect = rects[0]
        for r in rects[1:]:
            union_rect |= r
        return union_rect
    
    def add_comment(doc_page, position, comments, color, textType, subject, name):
        """
        Adds text annotations (comments) to the PDF page at the given position.
        Args:
            doc_page: The PDF page object.
            position: The (x, y) tuple or point where the comment should be placed.
            comments: List of comment dicts, each with a 'text' key.
            color: RGB tuple for the annotation color.
        """
        for comment in comments:
            if "text" in comment:
                if comment["text"] is not None:
                    annot_text_obj = doc_page.add_text_annot(
                        position, textType + ": " + comment["text"],
                        icon="Comment"  # Use a comment icon for text annotations
                    )
                    annot_text_obj.set_info({"title": name, "subject": subject})
                    annot_text_obj.set_colors(stroke=color)  # Set the color of the text annotation
                    annot_text_obj.update()  # Apply the color change

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
    def extract_comment(comment):
        """
        Extracts the comment text from the annotation info and removes specific prefixes.
        Args:
            comment: The comment string from the annotation info.
        Returns:
            The cleaned comment string with prefixes removed.
        """
        if not comment:
            return ""
        
        # Clean up the comment by removing extra spaces and newlines
        cleaned_comment = ' '.join(comment.split())
        
        # Remove specific prefixes
        prefixes_to_remove = ["Highlight:", "Strength:", "Weakness:", "Other:"]
        
        for prefix in prefixes_to_remove:
            if cleaned_comment.startswith(prefix):
                # Remove the prefix and any following whitespace
                cleaned_comment = cleaned_comment[len(prefix):].strip()
                break
        
        return cleaned_comment

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