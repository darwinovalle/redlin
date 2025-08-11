from dotenv import load_dotenv
from .models import Document, Summary, Flashcard, MCQ
from PyPDF2 import PdfReader
import google.generativeai as genai
import os
import re
import time
import random
from django.db import transaction
# Configure the Gemini API
load_dotenv()

# Configure Gemini
genai.configure(api_key=os.getenv('GOOGLE_API_KEY'))
model = genai.GenerativeModel("gemini-1.5-flash")


def _parse_retry_delay_seconds(error_message: str) -> int | None:
    """Try to extract retry_delay seconds from Gemini error string."""
    try:
        m = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", error_message)
        if m:
            return int(m.group(1))
    except Exception:
        pass
    return None


def generate_with_retry(prompt: str, *, max_attempts: int = 3, base_wait: int = 5):
    """
    Call Gemini generate_content with simple backoff for 429/quota errors.
    - Respects retry_delay seconds from the error if present.
    - Exponential backoff with jitter otherwise.
    """
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            return model.generate_content(prompt)
        except Exception as e:
            msg = str(e)
            # Heuristics for quota/rate-limit
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                suggested = _parse_retry_delay_seconds(msg)
                wait = suggested if suggested is not None else min(60, base_wait * (2 ** (attempt - 1)))
                # small jitter to avoid thundering herd
                wait = int(wait + random.uniform(0, 0.2) * wait)
                print(f"[RateLimit] Attempt {attempt}/{max_attempts} failed. Waiting {wait}s before retry.")
                time.sleep(wait)
                last_exc = e
                continue
            # Other errors: re-raise immediately
            raise
    # Exhausted retries
    if last_exc:
        raise last_exc
    raise RuntimeError("Generation failed without exception detail")

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
            summary_response = generate_with_retry(summary_prompt, max_attempts=3)
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
            flashcard_response = generate_with_retry(flashcard_prompt, max_attempts=3)
            flashcards_raw = flashcard_response.text
            flashcard_blocks = flashcards_raw.strip().split('\n\n')  # Split by blank lines

            # Parse first into in-memory objects
            new_flashcards = []
            for block in flashcard_blocks:
                lines = block.strip().split('\n')
                if len(lines) == 2:
                    term_line = lines[0]
                    def_line = lines[1]
                    if term_line.startswith('Term:') and def_line.startswith('Definition:'):
                        term = term_line.replace('Term:', '').strip()
                        definition = def_line.replace('Definition:', '').strip()
                        if term and definition:
                            new_flashcards.append(Flashcard(document=document, key_term=term, definition=definition))
                        else:
                            print(f"[Data Info] Skipping flashcard block due to empty term/definition after parsing: {block}")
                    else:
                        print(f"[Parsing Error] Skipping flashcard block, incorrect line prefixes: {block}")
                elif block.strip():
                    print(f"[Parsing Error] Skipping flashcard block, expected 2 lines but got {len(lines)}: {block}")

            # Replace only if we have new content
            if new_flashcards:
                with transaction.atomic():
                    Flashcard.objects.filter(document=document).delete()
                    Flashcard.objects.bulk_create(new_flashcards)
                print(f"Created {len(new_flashcards)} flashcards.")
            else:
                print("[Info] No valid flashcards parsed. Keeping existing ones.")

        except Exception as e:
            print(f"[Error] Failed to generate or parse flashcards: {e}")
            # Decide if you want to fail the whole process or continue

        # ---- Generate MCQs ----
        print("Generating MCQs...")
        mcq_prompt = f"Generate as many relevant multiple choice questions as possible based on the key concepts in the provided text. Focus on important information.\nFor each question, provide the question, the single correct answer, and three distinct incorrect distractors.\nFormat each question strictly as follows, with each part on a new line:\nQ: [Question text]\nA: [Correct Answer]\nB: [Incorrect Option 1]\nC: [Incorrect Option 2]\nD: [Incorrect Option 3]\n\nSeparate each complete question block (Q, A, B, C, D) with exactly one blank line.\n\n{text}"
        try:
            mcq_response = generate_with_retry(mcq_prompt, max_attempts=3)
            mcqs_raw = mcq_response.text
            mcq_blocks = mcqs_raw.strip().split('\n\n')

            new_mcqs = []
            for block in mcq_blocks:
                lines = block.strip().split('\n')
                if len(lines) == 5:  # Expecting Q, A, B, C, D
                    q_line, a_line, b_line, c_line, d_line = lines

                    if q_line.startswith('Q:') and a_line.startswith('A:') and b_line.startswith('B:') and c_line.startswith('C:') and d_line.startswith('D:'):
                        question = q_line.replace('Q:', '').strip()
                        correct_answer = a_line.replace('A:', '').strip()
                        option_1 = b_line.replace('B:', '').strip()  # Map B to option_1
                        option_2 = c_line.replace('C:', '').strip()  # Map C to option_2
                        option_3 = d_line.replace('D:', '').strip()  # Map D to option_3

                        if question and correct_answer and option_1 and option_2 and option_3:
                            new_mcqs.append(MCQ(
                                document=document,
                                question=question,
                                correct_answer=correct_answer,
                                option_1=option_1,
                                option_2=option_2,
                                option_3=option_3
                            ))
                        else:
                            print(f"[Data Info] Skipping MCQ block due to missing parts after parsing: {block}")
                    else:
                        print(f"[Parsing Error] Skipping MCQ block, incorrect line prefixes: {block}")
                elif block.strip():
                    print(f"[Parsing Error] Skipping MCQ block, expected 5 lines but got {len(lines)}: {block}")

            if new_mcqs:
                with transaction.atomic():
                    MCQ.objects.filter(document=document).delete()
                    MCQ.objects.bulk_create(new_mcqs)
                print(f"Created {len(new_mcqs)} MCQs.")
            else:
                print("[Info] No valid MCQs parsed. Keeping existing ones.")

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