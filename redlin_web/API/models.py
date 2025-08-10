from django.db import models

# Create your models here.

class User(models.Model):
    username = models.CharField(max_length=50)
    email = models.EmailField()
    password = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.username
    
class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255)
    upload_date = models.DateTimeField(auto_now_add=True)
    pdf_file = models.FileField(upload_to='documents/')
    processing_status = models.CharField(
        max_length=20,
        choices=[('pending', 'Pending'), ('processing', 'Processing'), ('completed', 'Completed')],
        default='pending'
    )

    def __str__(self):
        return self.title

class Summary(models.Model):
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name='summary')
    content = models.TextField()

    def __str__(self):
        return f"Summary for {self.document.title}"

class Flashcard(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='flashcards')
    key_term = models.CharField(max_length=255)
    definition = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=[('still_learning', 'Still Learning'), ('mastered', 'Mastered')],
        default='still_learning'
    )
    last_reviewed = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key_term

class MCQ(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='mcqs')
    question = models.TextField()
    correct_answer = models.CharField(max_length=255)
    option_1 = models.CharField(max_length=255)
    option_2 = models.CharField(max_length=255)
    option_3 = models.CharField(max_length=255)

    def __str__(self):
        return self.question

# Suggested UML Diagram Description:
# 1. User has a one-to-many relationship with Document.
# 2. Document has a one-to-one relationship with Summary.
# 3. Document has a one-to-many relationship with Flashcard and MCQ.
#
# Possible Django Workflow for Implementation:
# 1. User uploads a PDF via a form, stored in the Document model.
# 2. Backend processing generates:
#    - A summary (Summary model instance).
#    - Flashcards (Flashcard model instances).
#    - MCQs (MCQ model instances).
# 3. All generated data links back to the user and document.
# 4. The frontend retrieves data for the user to review and test their knowledge.
# 5. Flashcards include a status field (Still Learning/Mastered), and a review algorithm can prioritize "Still Learning" cards.
# 6. MCQs provide a way to test knowledge retention.
# 7. The user can track their progress and review history.
# 8. The user can upload more documents for processing.
