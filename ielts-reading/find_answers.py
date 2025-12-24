import pdfplumber
import re

pdf_path = 'IELTS Reading Test 310 – IELTS MASTER.pdf'

with pdfplumber.open(pdf_path) as pdf:
    full_text = ""
    for page in pdf.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

# Find answer key section - look for patterns like "1. FALSE" or "Answer:" or "Answers:"
# Check last 3000 characters
last_part = full_text[-3000:]

# Save to file to avoid encoding issues
with open('last_part.txt', 'w', encoding='utf-8') as f:
    f.write(last_part)

# Look for answer patterns
answer_patterns = [
    r'ANSWERS?\s*:?',
    r'Answer\s*Key',
    r'Answer\s*Sheet',
]

# Try to find numbered answers (1. FALSE, 2. TRUE, etc.)
answers = {}
lines = last_part.split('\n')
in_answer_section = False

for line in lines:
    line = line.strip()
    # Check if we're entering answer section
    if any(re.search(pattern, line, re.IGNORECASE) for pattern in answer_patterns):
        in_answer_section = True
        print(f"Found answer section header: {line}")
        continue
    
    if in_answer_section:
        # Match patterns like "1. FALSE" or "1 FALSE" or "1: FALSE" or "1 FALSE" or "1. A" or "1. bulbs"
        match = re.match(r'(\d+)[\.:)\s]+([A-Z\s]+)', line)
        if match:
            q_num = int(match.group(1))
            answer = match.group(2).strip()
            answers[q_num] = answer
        else:
            # Try other patterns like lowercase answers
            match2 = re.match(r'(\d+)[\.:)\s]+(.+)', line)
            if match2:
                q_num = int(match2.group(1))
                answer = match2.group(2).strip()
                answers[q_num] = answer

# Write answers to file
with open('answers.txt', 'w', encoding='utf-8') as f:
    for q_num in sorted(answers.keys()):
        f.write(f"{q_num}: {answers[q_num]}\n")
        print(f"{q_num}: {answers[q_num]}")

print(f"\nFound {len(answers)} answers. Written to answers.txt")

