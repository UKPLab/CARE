import os
import sys

sys.path.insert(0, os.path.abspath('../..'))

# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

# -- Project information -----------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#project-information

project = 'CARE'
copyright = '2023, Dennis Zyska, Nils Dycke'
author = 'Dennis Zyska, Nils Dycke'

# -- General configuration ---------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#general-configuration

extensions = [
    'sphinx.rpcs.autodoc',  # Core library for html generation from docstrings.
    'sphinx.rpcs.napoleon',  # Support for NumPy and Google style docstrings.
    'sphinx.rpcs.autosummary',  # Create neat summary tables for modules/classes/methods etc.
    'sphinx.rpcs.intersphinx',  # Link to other projects' documentation.
    'sphinx.rpcs.viewcode',  # Add a link to the Python source code of documented object.
    'sphinx.rpcs.todo',  # Support for todo items.
    'sphinx.rpcs.extlinks', # Support for external links.
    'sphinx.rpcs.autosectionlabel', # Support for autolabeling sections.
]
autosummary_generate = True  # Turn on sphinx.rpcs.autosummary

autodoc_default_options = {
    'members': True,
    'show-inheritance': True,
    'member-order': 'bysource',
    'special-members': '__init__',
    'undoc-members': True,
    'exclude-members': '__weakref__',
}
autoclass_content = 'both'  # Include both class docstring and __init__ docstring in class documentation.

templates_path = ['_templates']
exclude_patterns = []

# -- Options for HTML output -------------------------------------------------
# https://www.sphinx-doc.org/en/master/usage/configuration.html#options-for-html-output

html_theme = 'sphinx_rtd_theme'
html_static_path = ['_static']
