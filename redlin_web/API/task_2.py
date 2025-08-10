from dotenv import load_dotenv
from .models import Document, Summary, Flashcard, MCQ
from PyPDF2 import PdfReader
import google.generativeai as genai
import os
# Configure the Gemini API
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel("gemini-1.5-flash")

def process_pdf(document_id):
    document = Document.objects.get(id=document_id)
    if document.processing_status == 'completed':
        print(f"Document {document_id} already processed. Skipping.")
        return

    document.processing_status = 'processing'
    document.save()
    print(f"Processing document: {document.title} (ID: {document_id})")

    try:
        print("Extracting text from PDF...")
        reader = PdfReader(document.pdf_file.path)
        text = " ".join(page.extract_text() for page in reader.pages if page.extract_text())
        print(f"Extracted {len(text)} characters.")

        if not text.strip():
            print("No text extracted from PDF.")
            raise ValueError("Could not extract text from PDF")

        # ---- Generate Comprehensive Summary ----
        print("Generating summary...")
        summary_prompt = f"Provide a comprehensive and detailed summary of the following text, capturing the main points, key arguments, and important details. Aim for a thorough overview suitable for someone wanting to understand the core content without reading the entire document:\n\n{text}"
        try:
            summary_response = model.generate_content(summary_prompt)
            summary_content = summary_response.text
            Summary.objects.update_or_create(
                document=document,
                defaults={'content': summary_content}
            )
            print("Summary created/updated.")
        except Exception as e:
            print(f"[Error] Failed to generate summary: {e}")
            # Decide if you want to fail the whole process or continue

        # ---- Generate Flashcards ----
        print("Generating flashcards...")
        flashcard_prompt = f"Generate as many relevant flashcards as possible based on the key terms, concepts, and definitions in the following text. Focus on the most important information. Format each flashcard strictly as: Term: [key term]\nDefinition: [definition]\n\nSeparate each flashcard block (Term and Definition) with exactly one blank line.\n\n{text}"
        try:
            flashcard_response = model.generate_content(flashcard_prompt)
            flashcards_raw = flashcard_response.text
            flashcard_blocks = flashcards_raw.strip().split('\n\n') # Split by blank lines

            # Clear existing flashcards for this document before adding new ones
            Flashcard.objects.filter(document=document).delete()
            print(f"Cleared existing flashcards for document {document.id}")

            created_flashcards = 0
            for block in flashcard_blocks:
                lines = block.strip().split('\n')
                if len(lines) == 2:
                    term_line = lines[0]
                    def_line = lines[1]
                    if term_line.startswith('Term:') and def_line.startswith('Definition:'):
                        term = term_line.replace('Term:', '').strip()
                        definition = def_line.replace('Definition:', '').strip()
                        if term and definition:
                            Flashcard.objects.create(document=document, key_term=term, definition=definition)
                            created_flashcards += 1
                        else:
                            print(f"[Data Info] Skipping flashcard block due to empty term/definition after parsing: {block}")
                    else:
                        print(f"[Parsing Error] Skipping flashcard block, incorrect line prefixes: {block}")
                elif block.strip(): # Log non-empty blocks that don't have 2 lines
                    print(f"[Parsing Error] Skipping flashcard block, expected 2 lines but got {len(lines)}: {block}")
            print(f"Created {created_flashcards} flashcards.")

        except Exception as e:
            print(f"[Error] Failed to generate or parse flashcards: {e}")
            # Decide if you want to fail the whole process or continue

        # ---- Generate MCQs ----
        print("Generating MCQs...")
        mcq_prompt = f"Generate as many relevant multiple choice questions as possible based on the key concepts in the provided text. Focus on important information.\nFor each question, provide the question, the single correct answer, and three distinct incorrect distractors.\nFormat each question strictly as follows, with each part on a new line:\nQ: [Question text]\nA: [Correct Answer]\nB: [Incorrect Option 1]\nC: [Incorrect Option 2]\nD: [Incorrect Option 3]\n\nSeparate each complete question block (Q, A, B, C, D) with exactly one blank line.\n\n{text}"
        try:
            mcq_response = model.generate_content(mcq_prompt)
            mcqs_raw = mcq_response.text
            mcq_blocks = mcqs_raw.strip().split('\n\n')

            # Clear existing MCQs for this document before adding new ones
            MCQ.objects.filter(document=document).delete()
            print(f"Cleared existing MCQs for document {document.id}")

            created_mcqs = 0
            for block in mcq_blocks:
                lines = block.strip().split('\n')
                if len(lines) == 5: # Expecting Q, A, B, C, D
                    q_line = lines[0]
                    a_line = lines[1]
                    b_line = lines[2]
                    c_line = lines[3]
                    d_line = lines[4]

                    if q_line.startswith('Q:') and a_line.startswith('A:') and b_line.startswith('B:') and c_line.startswith('C:') and d_line.startswith('D:'):
                        question = q_line.replace('Q:', '').strip()
                        correct_answer = a_line.replace('A:', '').strip()
                        option_1 = b_line.replace('B:', '').strip() # Map B to option_1
                        option_2 = c_line.replace('C:', '').strip() # Map C to option_2
                        option_3 = d_line.replace('D:', '').strip() # Map D to option_3

                        if question and correct_answer and option_1 and option_2 and option_3:
                            MCQ.objects.create(
                                document=document,
                                question=question,
                                correct_answer=correct_answer,
                                option_1=option_1, 
                                option_2=option_2,
                                option_3=option_3
                            )
                            created_mcqs += 1
                        else:
                             print(f"[Data Info] Skipping MCQ block due to missing parts after parsing: {block}")
                    else:
                        print(f"[Parsing Error] Skipping MCQ block, incorrect line prefixes: {block}")
                elif block.strip():
                    print(f"[Parsing Error] Skipping MCQ block, expected 5 lines but got {len(lines)}: {block}")
            print(f"Created {created_mcqs} MCQs.")

        except Exception as e:
            print(f"[Error] Failed to generate or parse MCQs: {e}")
            # Decide if you want to fail the whole process or continue
        
        # ---- Finalize ----
        document.processing_status = 'completed'
        document.save()
        print(f"Successfully processed document {document.id}.")

    except Exception as e:
        print(f"[Fatal Error] Processing failed for document {document.id}: {e}")
        # Revert status to pending or set to failed on fatal error
        try:
            doc_to_update = Document.objects.get(id=document_id)
            doc_to_update.processing_status = 'failed' # Or 'pending'
            doc_to_update.save()
        except Document.DoesNotExist:
            print(f"Document {document_id} not found for status update after error.")
        # Re-raise the exception if you want the task runner (e.g., Celery) to know it failed
        # raise e