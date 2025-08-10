from PyPDF2 import PdfReader
import nltk
from .models import Summary, Flashcard, MCQ

nltk.download('punkt')
nltk.download('punkt_tab')

def process_pdf(document_id):
    from .models import Document

    # Retrieve the document
    document = Document.objects.get(id=document_id)
    document.processing_status = 'processing'
    document.save()

    try:
        # Extract text from PDF
        reader = PdfReader(document.pdf_file.path)
        text = " ".join(page.extract_text() for page in reader.pages)

        # Generate a summary (placeholder logic)
        sentences = nltk.sent_tokenize(text)
        summary_content = " ".join(sentences[:5])  # Take the first 5 sentences as a summary

        # Save the summary
        summary = Summary.objects.create(document=document, content=summary_content)

        # Generate flashcards (placeholder logic)
        words = nltk.word_tokenize(text)
        keywords = set(words[:10])  # Take the first 10 unique words
        for keyword in keywords:
            Flashcard.objects.create(
                document=document,
                key_term=keyword,
                definition=f"This is a placeholder definition for {keyword}."
            )

        # Generate MCQs (placeholder logic)
        for i, sentence in enumerate(sentences[:3]):  # Take the first 3 sentences
            MCQ.objects.create(
                document=document,
                question=f"What does the following mean: {sentence}?",
                correct_answer="Correct Answer Placeholder",
                option_1="Option 1",
                option_2="Option 2",
                option_3="Option 3"
            )

        document.processing_status = 'completed'
        document.save()

    except Exception as e:
        document.processing_status = 'pending'
        document.save()
        raise e
