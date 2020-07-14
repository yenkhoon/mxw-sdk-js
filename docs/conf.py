# -*- coding: utf-8 -*-
#
# import os
# import sys
import time
# sys.path.insert(0, os.path.abspath('.'))


# -- Project information -----------------------------------------------------

project = 'mxw-sdk-js'
copyright = '2019–'+ time.strftime("%Y")+', Maxonrow'
author = 'Jean Soon'

# The short X.Y version
version = ''
# The full version, including alpha/beta/rc tags
release = '1'


# -- General configuration ---------------------------------------------------

# If your documentation needs a minimal Sphinx version, state it here.
#
# needs_sphinx = '1.0'

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = [
    'sphinx.ext.todo',
    'sphinx.ext.githubpages',
]

# Add any paths that contain templates here, relative to this directory.
templates_path = ['_templates']

# The suffix(es) of source filenames.
# You can specify multiple suffix as a list of string:
#
# source_suffix = ['.rst', '.md']
source_suffix = '.rst'

# The master toctree document.
master_doc = 'index'

# The language for content autogenerated by Sphinx. Refer to documentation
# for a list of supported languages.
#
# This is also used if you do content translation via gettext catalogs.
# Usually you set "language" from the command line for these cases.
language = None

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path .
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']

# The name of the Pygments (syntax highlighting) style to use.
pygments_style = 'sphinx'


# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation for
# a list of builtin themes.
#

# Theme options are theme-specific and customize the look and feel of a theme
# further.  For a list of options available for each theme, see the
# documentation.
#


# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
html_static_path = ['_static']

# Custom sidebar templates, must be a dictionary that maps document names
# to template names.
#
# The default sidebars (for documents that don't match any pattern) are
# defined by theme itself.  Builtin themes are using these templates by
# default: ``['localtoc.html', 'relations.html', 'sourcelink.html',
# 'searchbox.html']``.
#
# html_sidebars = {}
#---sphinx-themes-----

html_theme = 'sphinx_rtd_theme'
html_theme_path = ["_themes",]

html_theme_options = {
  'collapse_navigation': True,
  'sticky_navigation': False,
  'style_nav_header_background': '#000056',
  'prev_next_buttons_location': 'both',
  'style_external_links':True,
}

# html_theme ='classic'
# html_theme_options = {
#   'rightsidebar' : False,
#   'collapsiblesidebar' : True,
#   'externalrefs' : True,
#   'footerbgcolor' : '#000000',
#   'footertextcolor' : '#995555',
#   'sidebartextcolor' : '#654321',
#   'sidebarlinkcolor' : '#ffffff',
#   'relbarbgcolor' : '#00ff00',
#   'bgcolor' : '#0000ff',
#   'headbgcolor' : '#990099',

# }
# extensions = ['sphinxjp.themes.revealjs']
# html_theme = 'revealjs'
# html_use_index = False
# html_theme = 'sphinx_drove_theme'
# import sphinx_drove_theme
# html_theme_path = [sphinx_drove_theme.get_html_theme_path()]
#adding css
def setup(app):
  app.add_stylesheet( "css/hatnotes.css" )
  app.add_stylesheet( "css/text.css")
  app.add_stylesheet( "css/custom.css")