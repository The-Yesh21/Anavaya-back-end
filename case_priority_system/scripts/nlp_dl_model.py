import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
import pandas as pd
import numpy as np

# Simple Neural Network for Case Priority
class CasePriorityNN(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super(CasePriorityNN, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)
        self.softmax = nn.Softmax(dim=1)
        
    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out

def train_dl_model():
    # Load data
    df = pd.read_csv('case_priority_system/data/synthetic_cases.csv')
    
    # NLP Preprocessing (TF-IDF for simplicity in this demo)
    tfidf = TfidfVectorizer(max_features=500)
    X_text = tfidf.fit_transform(df['description']).toarray()
    
    # Target Encoding
    le = LabelEncoder()
    y = le.fit_transform(df['priority'])
    
    # Convert to Tensors
    X_tensor = torch.tensor(X_text, dtype=torch.float32)
    y_tensor = torch.tensor(y, dtype=torch.long)
    
    # Hyperparameters
    input_size = X_text.shape[1]
    hidden_size = 64
    num_classes = len(le.classes_)
    learning_rate = 0.001
    num_epochs = 50
    
    # Model, Loss, Optimizer
    model = CasePriorityNN(input_size, hidden_size, num_classes)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    # Training Loop
    print("Starting Deep Learning Model Training...")
    for epoch in range(num_epochs):
        # Forward pass
        outputs = model(X_tensor)
        loss = criterion(outputs, y_tensor)
        
        # Backward and optimize
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        if (epoch+1) % 10 == 0:
            print(f'Epoch [{epoch+1}/{num_epochs}], Loss: {loss.item():.4f}')
            
    # Save Model
    torch.save({
        'model_state_dict': model.state_dict(),
        'tfidf': tfidf,
        'label_encoder': le,
        'input_size': input_size,
        'hidden_size': hidden_size,
        'num_classes': num_classes
    }, 'case_priority_system/models/priority_dl_model.pth')
    print("Deep Learning model saved.")

if __name__ == "__main__":
    train_dl_model()
