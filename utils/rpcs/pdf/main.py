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
        Extracts all annotations (such as highlights and comments) from a PDF file, collects their metadata and text, and then removes them from the document. 
        Returns the extracted annotation data, the full text of the document, and the modified PDF file with annotations deleted.
        Args:
            sid: Socket.IO session id.
            data: Dictionary containing the PDF file (as bytes) and document hash.
        Returns:
            A response dict with annotation data, full text, and the modified PDF file.
        """
        logger.info(f"Received call: {data} from {sid}")
        try:
            doc = pymupdf.open(stream=data["file"])
            annotations = []
            whole_text = ""
            
            # Process each page once, collecting text and annotations
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                whole_text += page_text
                
                for annot in page.annots():
                    logger.info(
                        f'Annotation on page: {page.number} with type: {annot.type} and rect: {annot.vertices} and color: {annot.colors} text: {annot.info["content"]} textbox: {page.get_textbox(annot.rect) } text: {annot.get_text("text")}'
                    )
                    
                    # Use the new function to get highlighted words (intersection + color check)
                    words_on_page = page.get_text("words")
                    highlighted_words = extract_annot(annot, words_on_page)
                    logger.info(f"Highlighted words: {highlighted_words}")  

                    # Find the position of the annotated text in the page
                    text_start = page_text.find(annot.get_text("text"))
                    if text_start != -1:
                        prefix_start = max(0, text_start - 30)
                        prefix = page_text[prefix_start:text_start]
                        
                        text_end = text_start + len(annot.get_text("text"))
                        suffix_end = min(len(page_text), text_end + 30)
                        suffix = page_text[text_end:suffix_end]
                    else:
                        prefix = ""
                        suffix = ""
                    
                    annotations.append({
                        "page": page.number,
                        "type": annot.type[1] if isinstance(annot.type, tuple) else annot.type,
                        "rect": list(annot.rect),
                        "comment": annot.info.get("content", ""),
                        "text": highlighted_words,  # Only return the highlighted words
                        "color": annot.colors,
                        "prefix": prefix,
                        "suffix": suffix,
                    })
                # Delete all highlight annotations
                    annot.update(fill_color=(0, 0, 0))
                    logger.info(f"Deleted annot: {annot}")
                    page.delete_annot(annot)
            
            # Get the modified PDF as a buffer
            output_buffer = doc.write()

            response = {
                "success": True,
                "message": "Annotations extracted successfully.",
                "data": {
                    "annotations": annotations,
                    "wholeText": whole_text,
                    "file": output_buffer
                }
            }
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

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
        logger.info(f"Received call: {data} from {sid}")
        try:
            # Open the PDF directly from memory
            doc = pymupdf.open(stream=data["file"])

            annotations = data.get("annotations", [])
            if not annotations:
                response = {"success": True, "message": "No annotations provided.", "data": data["file"]}
                logger.info("No annotations provided, returning original PDF.")
                return response
            
            for annot in annotations:
                # Extract page number from annotation selectors
                page_number = None
                selectors = annot.get("selectors", {})
                targets = selectors.get("target", [])
                text_start = None
                logger.info(f"Processing annotation: {annot}")
                color_code = annot.get("tag", "danger")  # Default to "danger" if not provided
                color = (1, 1, 0) #always yellow for highlight
                text_end = None
                prefix = None
                exact = None
                suffix = None
                if targets and isinstance(targets, list):
                    for target in targets:
                        for selector in target.get("selector", []):
                            logger.info("Selector found %s", selector)
                            match selector.get("type"):
                                case "PagePositionSelector":
                                    page_number = selector.get("number")
                                case "TextPositionSelector":
                                    text_start = selector.get("start")
                                    text_end = selector.get("end")
                                case "TextQuoteSelector":
                                    logger.info("TextQuoteSelector found %s", selector)
                                    prefix = selector.get("prefix")
                                    exact = selector.get("exact")
                                    suffix = selector.get("suffix")
                        if page_number is not None:
                            break
                logger.info(f"Page number: {page_number}")
                logger.info(f"Text start: {text_start}")
                logger.info(f"Text end: {text_end}")
                logger.info(f"Text: {exact}")
                logger.info(f"Prefix: {prefix}")
                logger.info(f"Suffix: {suffix}")
                full_rect = None
                if page_number is not None:
                    doc_page = doc[page_number-1]
                    selected_rect = get_best_exact_rect(doc_page, exact, prefix, suffix)
                    
                    if selected_rect is not None and not selected_rect.is_empty:
                        extracted_text = doc_page.get_textbox(selected_rect)
                        logger.info(f"Extracted text: {extracted_text}")
                        logger.warning(f"Extracted text '{extracted_text}' does not match expected text '{exact}'")
                        full_rect = add_annotations(doc_page, selected_rect, extracted_text, exact, color)
                        add_comment(doc_page, (selected_rect.x0, selected_rect.y0), annot.get("comments", []), color)
                        logger.info(f"Full full rect: {full_rect}")
                    else:
                        logger.warning("No suitable rect found for annotation.")

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
    def add_annotations(doc_page, selected_rect, extracted_text, original_text, color):
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
        logger.info(f"Starting highlight_long_text with extracted_text: {extracted_text!r}, original_text: {original_text!r}")
        logger.info(f"Selected rect: {selected_rect}")

            # First, check if the selected_rect's text matches the original_text
        selected_text = doc_page.get_textbox(selected_rect).strip()
        logger.info(f"Text in selected_rect: {selected_text!r}")

        if selected_text == original_text.strip():
            logger.info("Selected rect text matches original text. Highlighting selected_rect only.")
            annot = doc_page.add_highlight_annot(selected_rect)
            annot.set_colors(stroke=color)
            annot.update()
            logger.info(f"Highlighted selected_rect: {selected_rect}")
            return selected_rect

        words = doc_page.get_text("words")  # Each word: (x0, y0, x1, y1, "word", block_no, line_no, word_no)
        logger.info(f"Found {len(words)} words on page")

        found = False
        result_text = extracted_text
        rects = [selected_rect]
        original_text_length = len(original_text.strip().split(" ")) if original_text else 0
        
        splits = original_text.strip().split(" ")
        logger.info(f"Original text split into {len(splits)} parts: {splits}")
        highlighted_count = 0

        for i, word in enumerate(words):
            x0, y0, x1, y1, text, *_ = word
            word_rect = pymupdf.Rect(x0, y0, x1, y1)
            logger.debug(f"Word {i}: rect={word_rect}, text={text!r}")
            if found:
                if highlighted_count >= original_text_length - 1:
                    logger.info(f"Highlighted {highlighted_count} words, stopping as per original_text length.")
                    break
                result_text += (" " if not result_text.endswith(" ") else "") + text
                rects.append(word_rect)
                # Highlight this word
                annot = doc_page.add_highlight_annot(word_rect)
                annot.set_colors(stroke=color)
                annot.update()
                highlighted_count += 1
                logger.info(f"Highlighted word {i}: {text!r} at {word_rect} (count: {highlighted_count})")
                logger.info(f"Current concatenated text: {result_text!r}")
            elif word_rect.intersects(selected_rect):
                logger.info(f"Found starting word {i} intersecting selected_rect")
                found = True
                # Optionally highlight the starting word as well
                annot = doc_page.add_highlight_annot(word_rect)
                annot.set_colors(stroke=color)
                annot.update()
                logger.info(f"Highlighted starting word {i}: {text!r} at {word_rect}")

        # If no words highlighted, just return the selected_rect
        if len(rects) == 1:
            logger.warning("No additional words highlighted, returning selected_rect")
            return selected_rect

        # Return the union of all collected rects
        union_rect = rects[0]
        for r in rects[1:]:
            union_rect |= r
        logger.info(f"Returning union rect: {union_rect}")
        return union_rect
    
    def add_comment(doc_page, position, comments, color):
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
                logger.info(f"Adding text annotation: {comment['text']}")
                if comment["text"] is not None:
                    annot_text_obj = doc_page.add_text_annot(
                        position, comment["text"],
                        icon="Comment"  # Use a comment icon for text annotations
                    )
                    annot_text_obj.set_colors(stroke=color)  # Set the color of the text annotation
                    annot_text_obj.update()  # Apply the color change
                    logger.info(f"Text annotation object: {annot_text_obj}")

    _threshold_intersection = 0.1  # if the intersection is large enough.

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