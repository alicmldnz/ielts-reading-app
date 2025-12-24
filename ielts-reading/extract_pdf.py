import pdfplumber
import sys

pdf_path = sys.argv[1] if len(sys.argv) > 1 else 'IELTS Reading Test 310 – IELTS MASTER.pdf'

with pdfplumber.open(pdf_path) as pdf:
    full_text = ""
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
    
    # Write to file
    with open('pdf_extracted.txt', 'w', encoding='utf-8') as f:
        f.write(full_text)
    
    print(f"Extracted {len(full_text)} characters")
    print("First 2000 characters:")
    print(full_text[:2000])

