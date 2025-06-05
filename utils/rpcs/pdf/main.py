import math
import os
import logging
import socketio
import pymupdf
import json

__author__ = "Karim Ouf"

def create_app():
    logging.basicConfig(level=logging.INFO)
    logger = logging.getLogger('gunicorn.error')
    logger.setLevel(logging.INFO)

    sio = socketio.Server(async_mode='threading')

    @sio.event
    def connect(sid, environ, auth):
        logger.info(f"Connection established with {sid}")

    @sio.on("call")
    def call(sid, data):
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
        logger.info(f"Received call: {data} from {sid}")
        try:
            doc_hash = data["document"]["hash"]
            target = os.path.join("uploads", f"{doc_hash}.pdf")
            with open(target, "wb") as f:
                f.write(data["file"])
            doc = pymupdf.open(target)
            response = {"success": True, "message": "PDF read successfully"}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    @sio.on("annotations")
    def annotations(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        try:
            doc_hash = data["document"]["hash"]
            os.makedirs("uploads", exist_ok=True)
            target = os.path.join("uploads",  f"{doc_hash}.pdf")
            with open(target, "wb") as f:
                f.write(data["file"])
            doc = pymupdf.open(target)
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
                    
                    # Create tag information based on annotation color
                    color_code, color_name, tag_id = get_color_code_from_annotation(annot.colors)
                    tag_info = {
                        "name": color_name,
                        "description": color_name,
                        "colorCode": color_code,
                        "public": False,
                        "id": tag_id
                    }
                    
                    annotations.append({
                        "page": page.number,
                        "type": annot.type[1] if isinstance(annot.type, tuple) else annot.type,
                        "rect": list(annot.rect),
                        "comment": annot.info.get("content", ""),
                        "text": highlighted_words,  # Only return the highlighted words
                        "color": annot.colors,
                        "prefix": prefix,
                        "suffix": suffix,
                        "tag": tag_info
                    })
                # Delete all highlight annotations
                    annot.update(fill_color=(0, 0, 0))
                    logger.info(f"Deleted annot: {annot}")
                    page.delete_annot(annot)
                    

            
            # After processing all pages and annotations, save the modified PDF
            doc.save(target, incremental=True, encryption=0)
            with open(target, "rb") as f:
                file_bytes = f.read()

            response = {
                "success": True,
                "message": "Annotations extracted successfully.",
                "data": {
                    "annotations": annotations,
                    "wholeText": whole_text,
                    "file": file_bytes
                }
            }
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    #       create

    @sio.on("embedAnnotations")
    def embeddAnnotations(sid, data):
        logger.info(f"Received call: {data} from {sid}")
        # Todo:add comment to annotate in pdf
        try:
        # Extract the document hash for file naming
            doc_hash = data["document"]["hash"]
            os.makedirs("uploads", exist_ok=True)
            file_target = os.path.join("uploads", f"{doc_hash}.pdf")

            # Write the PDF file buffer to disk
            with open(file_target, "wb") as f:
                f.write(data["file"])

            # Open the PDF
            doc = pymupdf.open(file_target)

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
                color = get_color_from_code(color_code)
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
            # Save the modified PDF
            logger.info(f"Saving PDF with annotations to {file_target}")
            doc.save(file_target, incremental=True,  encryption=0)
            with open(file_target, "rb") as f:
                file_bytes = f.read()
            #todo: return file 
            response = {"success": True, "message": "PDF with annotations saved successfully", "data": file_bytes}
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    @sio.on("deleteAllAnnotations")
    def delete_all_annotations(sid, data):
        logger.info(f"Received deleteAllAnnotations call: {data} from {sid}")
        try:
            doc_hash = data["document"]["hash"]
            os.makedirs("uploads", exist_ok=True)
            target = os.path.join("uploads",  f"{doc_hash}.pdf")
            with open(target, "wb") as f:
                f.write(data["file"])
            doc = pymupdf.open(target)
            # Remove all annotations from all pages
            for page in doc:
                annots = [a for a in page.annots()]
                for annot in annots:
                    page.delete_annot(annot)
            # Save the modified PDF incrementally
            doc.save(target, incremental=True, encryption=0)
            with open(target, "rb") as f:
                file_bytes = f.read()
            response = {
                "success": True,
                "message": "All annotations deleted successfully.",
                "data": {
                    "file": file_bytes
                }
            }
            return response
        except Exception as e:
            logger.error(f"Error: {e}")
            response = {"success": False, "message": "error: " + str(e)}
            return response

    def search_with_reduction(doc_page, search_string, quads=False):
        """
        Search for the string on the page, reducing one character at a time from the end until a match is found.
        Returns the list of rects found (may be empty if nothing matches).
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
        Return the rect of the 'exact' string that is closest to prefix and suffix.
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
    def get_color_code_from_annotation(colors):
        """
        Convert annotation RGB colors to tag color code
        Returns one of: "info" (blue), "success" (green), "warning" (yellow), "danger" (red)
        """
        if not colors:
            return "info"  # default color
            
        r, g, b = colors["stroke"] if isinstance(colors, dict) else colors
        
        # Check which color is dominant
        if r > 0.5 and g < 0.3 and b < 0.3:
            return "danger", "Weakness", 3 # red
        elif g > 0.5 and r < 0.3 and b < 0.3:
            return "success", "Strength", 2  # green
        elif r > 0.5 and g > 0.5 and b < 0.3:
            return "warning", "Highlight", 1  # yellow
        else:
            return "info", "Other", 4  # blue or default
    
    def get_color_from_code(color_code):
        """
        Map a color code string to an RGB tuple for PyMuPDF.
        Options:
            - "info": blue
            - "success": green
            - "warning": yellow
            - "danger": red
        """
        color_map = {
            "info": (0, 0, 1),      # Blue
            "success": (0, 1, 0),   # Green
            "warning": (1, 1, 0),   # Yellow
            "danger": (1, 0, 0),    # Red
        }
        return color_map.get(color_code, (1, 0, 0))  # Default to red if not found
    def add_annotations(doc_page, selected_rect, extracted_text, original_text, color):
        """
        Expand the selected_rect forward word by word, highlighting each word,
        and stop after highlighting as many words as in the original_text.
        Returns a new rectangle covering from the start of selected_rect to the end.
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
        :param doc_page: The PDF page object.
        :param position: The (x, y) tuple or point where the comment should be placed.
        :param comments: List of comment dicts, each with a 'text' key.
        :param color: RGB tuple for the annotation color.
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
        """If `r_word` is contained in the rectangular area.

        The area of the intersection should be large enough compared to the
        area of the given word.

        Args:
            r_word (pymupdf.Rect): rectangular area of a single word.
            points (list): list of points in the rectangular area of the
                given part of a highlight.

        Returns:
            bool: whether `r_word` is contained in the rectangular area.
        """
        # `r` is mutable, so everytime a new `r` should be initiated.
        r = pymupdf.Quad(points).rect
        r.intersect(r_word)

        if r.get_area("cm") >= r_word.get_area("cm") * _threshold_intersection:
            contain = True
        else:
            contain = False
        return contain

    def extract_annot(annot, words_on_page):
        """Extract words in a given highlight.

        Args:
            annot (pymupdf.Annot): [description]
            words_on_page (list): [description]

        Returns:
            str: words in the entire highlight.
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
    # def delete_annot(annot, page):
    #     deleted = page.delete_annot(annot)
    #     logger.info(f"Deleted annot: {deleted}")
    
    logger.info("Creating App...")
    app = socketio.WSGIApp(sio)
    return app