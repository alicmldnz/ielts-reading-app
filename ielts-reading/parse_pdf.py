import sys
import os

try:
    import PyPDF2
    has_pypdf2 = True
except ImportError:
    has_pypdf2 = False

try:
    import pdfplumber
    has_pdfplumber = True
except ImportError:
    has_pdfplumber = False

if len(sys.argv) < 2:
    print("Usage: python parse_pdf.py <pdf_file_path>")
    sys.exit(1)

pdf_path = sys.argv[1]

if not os.path.exists(pdf_path):
    print(f"ERROR: File not found: {pdf_path}")
    sys.exit(1)

text_content = ""

if has_pdfplumber:
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                text_content += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error with pdfplumber: {e}", file=sys.stderr)
        text_content = ""

if not text_content and has_pypdf2:
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text_content += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error with PyPDF2: {e}", file=sys.stderr)

if not text_content:
    print("ERROR: Could not extract text. Please install pdfplumber or PyPDF2:")
    print("  pip install pdfplumber")
    print("  or")
    print("  pip install PyPDF2")
    sys.exit(1)

print(text_content)

