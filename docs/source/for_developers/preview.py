import docutils.core

# Define a function to convert rst to html
def convert_rst_to_html(input_rst, output_html):
    with open(input_rst, 'r') as rst_file:
        rst_content = rst_file.read()

    # Convert rst to html using docutils
    html_content = docutils.core.publish_string(
        rst_content, writer_name='html'
    ).decode('utf-8')

    # Save the HTML content to a file
    with open(output_html, 'w') as html_file:
        html_file.write(html_content)

    print(f"Preview generated: {output_html}")

# Example usage
convert_rst_to_html('docs/source/for_developers/working_with_moodle_API.rst', 'preview.html')
