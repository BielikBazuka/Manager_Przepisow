// Recipe Manager Application
const app = {
    recipes: [],
    ingredients: {},
    customIngredients: {},
    currentRecipe: null,
    editingRecipe: null,

    init() {
        // Load ingredients from ingredients.js
        if (typeof INGREDIENTS_DB !== 'undefined') {
            this.ingredients = {...INGREDIENTS_DB};
            console.log('Loaded', Object.keys(this.ingredients).length, 'ingredients from database');
        } else {
            console.error('INGREDIENTS_DB not found! Make sure ingredients.js is loaded.');
            this.ingredients = {};
        }
        
        // Load custom ingredients from localStorage
        const savedCustomIngredients = localStorage.getItem('customIngredients');
        if (savedCustomIngredients) {
            this.customIngredients = JSON.parse(savedCustomIngredients);
            this.ingredients = {...this.ingredients, ...this.customIngredients};
            console.log('Loaded', Object.keys(this.customIngredients).length, 'custom ingredients');
        }
        
        // Load recipes from localStorage
        const saved = localStorage.getItem('recipes');
        if (saved) {
            this.recipes = JSON.parse(saved);
        }
        
        // Populate ingredient select
        this.populateIngredientSelect();
        
        // Render everything
        this.renderRecipes();
        this.renderIngredientDatabase();
        this.updateFilters();
        
        // Add first step by default
        this.currentRecipe = {
            name: '',
            categories: [],
            tags: [],
            ingredients: [],
            steps: ['']
        };
    },

    // Save recipes to localStorage
    saveToStorage() {
        localStorage.setItem('recipes', JSON.stringify(this.recipes));
        // Only save custom ingredients, not the whole database
        localStorage.setItem('customIngredients', JSON.stringify(this.customIngredients));
    },

    // Populate ingredient dropdown
    populateIngredientSelect() {
        const select = document.getElementById('ingredientSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Wybierz składnik</option>';
        
        Object.keys(this.ingredients).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    },

    // Update category and tag filters
    updateFilters() {
        const categories = new Set();
        const tags = new Set();
        
        this.recipes.forEach(recipe => {
            recipe.categories.forEach(cat => categories.add(cat));
            recipe.tags.forEach(tag => tags.add(tag));
        });
        
        // Update category filter
        const categoryFilter = document.getElementById('categoryFilter');
        if (categoryFilter) {
            categoryFilter.innerHTML = '<option value="all">Wszystkie kategorie</option>';
            Array.from(categories).sort().forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                categoryFilter.appendChild(option);
            });
        }
        
        // Update tag filter
        const tagFilter = document.getElementById('tagFilter');
        if (tagFilter) {
            tagFilter.innerHTML = '<option value="all">Wszystkie tagi</option>';
            Array.from(tags).sort().forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = `#${tag}`;
                tagFilter.appendChild(option);
            });
        }
    },

    // Filter recipes
    filterRecipes() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const tagFilter = document.getElementById('tagFilter').value;
        
        const filtered = this.recipes.filter(recipe => {
            const matchesSearch = recipe.name.toLowerCase().includes(searchTerm) ||
                recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm));
            const matchesCategory = categoryFilter === 'all' || recipe.categories.includes(categoryFilter);
            const matchesTag = tagFilter === 'all' || recipe.tags.includes(tagFilter);
            
            return matchesSearch && matchesCategory && matchesTag;
        });
        
        this.renderRecipes(filtered);
    },

    // Calculate recipe calories
    calculateCalories(ingredients) {
        return ingredients.reduce((total, ing) => {
            const baseIng = this.ingredients[ing.name.toLowerCase()];
            if (!baseIng) return total;
            
            const multiplier = ing.amount / 100;
            return total + (baseIng.kcal * multiplier);
        }, 0);
    },

    // Render recipes
    renderRecipes(recipesToRender = this.recipes) {
        const grid = document.getElementById('recipesGrid');
        if (!grid) return;
        
        if (recipesToRender.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">🍽️</div>
                    <p>${this.recipes.length === 0 ? 'Brak przepisów. Dodaj swój pierwszy przepis!' : 'Nie znaleziono przepisów.'}</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = recipesToRender.map(recipe => `
            <div class="recipe-card">
                <div class="recipe-header">
                    <h3 class="recipe-title">${recipe.name}</h3>
                    <div class="recipe-actions">
                        <button class="icon-btn" onclick="app.downloadPDF(${recipe.id})" title="Pobierz PDF">📥</button>
                        <button class="icon-btn" onclick="app.editRecipe(${recipe.id})" title="Edytuj">✏️</button>
                        <button class="icon-btn" onclick="app.deleteRecipe(${recipe.id})" title="Usuń">🗑️</button>
                    </div>
                </div>
                
                <div class="tags-container">
                    ${recipe.categories.map(cat => `<span class="tag tag-category">${cat}</span>`).join('')}
                    ${recipe.tags.map(tag => `<span class="tag tag-item">#${tag}</span>`).join('')}
                </div>
                
                <div class="ingredients-section">
                    <h4>📋 Składniki:</h4>
                    ${recipe.ingredients.map(ing => {
                        const baseIng = this.ingredients[ing.name.toLowerCase()];
                        const calories = baseIng ? Math.round((ing.amount / 100) * baseIng.kcal) : 0;
                        return `
                            <div class="ingredient-item">
                                <span class="ingredient-name">${ing.name}: ${ing.amount}${ing.unit}</span>
                                <span class="ingredient-calories">${calories} kcal</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div class="steps-section">
                    <h4>👨‍🍳 Przygotowanie:</h4>
                    <ol>
                        ${recipe.steps.filter(s => s).map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </div>
                
                <div class="total-calories">
                    🔥 Razem: ${recipe.totalCalories} kcal
                </div>
            </div>
        `).join('');
    },

    // Render ingredient database
    renderIngredientDatabase() {
        const list = document.getElementById('ingredientsList');
        const count = document.getElementById('ingredientCount');
        
        if (!list || !count) return;
        
        const totalCount = Object.keys(this.ingredients).length;
        count.textContent = totalCount;
        
        list.innerHTML = Object.entries(this.ingredients)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, data]) => `
                <div class="ingredient-db-item">
                    <div class="ingredient-db-name">${name}</div>
                    <div class="ingredient-db-calories">${data.kcal} kcal / ${data.unit}</div>
                </div>
            `).join('');
    },

    // Show add recipe modal
    showAddRecipe() {
        this.editingRecipe = null;
        this.currentRecipe = {
            name: '',
            categories: [],
            tags: [],
            ingredients: [],
            steps: ['']
        };
        
        document.getElementById('modalTitle').textContent = 'Nowy przepis';
        document.getElementById('recipeName').value = '';
        document.getElementById('categoriesList').innerHTML = '';
        document.getElementById('tagsList').innerHTML = '';
        document.getElementById('ingredientItems').innerHTML = '';
        document.getElementById('totalCalories').innerHTML = '';
        this.renderSteps();
        
        document.getElementById('recipeModal').classList.add('active');
    },

    // Close recipe modal
    closeRecipeModal() {
        document.getElementById('recipeModal').classList.remove('active');
    },

    // Add category
    addCategory() {
        const input = document.getElementById('categoryInput');
        const value = input.value.trim();
        
        if (value && !this.currentRecipe.categories.includes(value)) {
            this.currentRecipe.categories.push(value);
            this.renderCategories();
            input.value = '';
        }
    },

    // Remove category
    removeCategory(index) {
        this.currentRecipe.categories.splice(index, 1);
        this.renderCategories();
    },

    // Render categories
    renderCategories() {
        const list = document.getElementById('categoriesList');
        list.innerHTML = this.currentRecipe.categories.map((cat, i) => `
            <span class="tag tag-category">
                ${cat}
                <button onclick="app.removeCategory(${i})">✕</button>
            </span>
        `).join('');
    },

    // Add tag
    addTag() {
        const input = document.getElementById('tagInput');
        const value = input.value.trim();
        
        if (value && !this.currentRecipe.tags.includes(value)) {
            this.currentRecipe.tags.push(value);
            this.renderTags();
            input.value = '';
        }
    },

    // Remove tag
    removeTag(index) {
        this.currentRecipe.tags.splice(index, 1);
        this.renderTags();
    },

    // Render tags
    renderTags() {
        const list = document.getElementById('tagsList');
        list.innerHTML = this.currentRecipe.tags.map((tag, i) => `
            <span class="tag tag-item">
                #${tag}
                <button onclick="app.removeTag(${i})">✕</button>
            </span>
        `).join('');
    },

    // Add ingredient
    addIngredient() {
        const name = document.getElementById('ingredientSelect').value;
        const amount = document.getElementById('ingredientAmount').value;
        const unit = document.getElementById('ingredientUnit').value;
        
        if (name && amount) {
            this.currentRecipe.ingredients.push({ name, amount: parseFloat(amount), unit });
            this.renderIngredients();
            
            document.getElementById('ingredientSelect').value = '';
            document.getElementById('ingredientAmount').value = '';
        }
    },

    // Remove ingredient
    removeIngredient(index) {
        this.currentRecipe.ingredients.splice(index, 1);
        this.renderIngredients();
    },

    // Render ingredients
    renderIngredients() {
        const list = document.getElementById('ingredientItems');
        const totalDiv = document.getElementById('totalCalories');
        
        list.innerHTML = this.currentRecipe.ingredients.map((ing, i) => {
            const baseIng = this.ingredients[ing.name.toLowerCase()];
            const calories = baseIng ? Math.round((ing.amount / 100) * baseIng.kcal) : 0;
            
            return `
                <div class="ingredient-item-edit">
                    <span>${ing.name} - ${ing.amount}${ing.unit} (${calories} kcal)</span>
                    <button class="icon-btn" onclick="app.removeIngredient(${i})">🗑️</button>
                </div>
            `;
        }).join('');
        
        const total = Math.round(this.calculateCalories(this.currentRecipe.ingredients));
        totalDiv.innerHTML = this.currentRecipe.ingredients.length > 0 
            ? `🔥 Razem: ${total} kcal` 
            : '';
    },

    // Add step
    addStep() {
        this.currentRecipe.steps.push('');
        this.renderSteps();
    },

    // Remove step
    removeStep(index) {
        if (this.currentRecipe.steps.length > 1) {
            this.currentRecipe.steps.splice(index, 1);
            this.renderSteps();
        }
    },

    // Update step
    updateStep(index, value) {
        this.currentRecipe.steps[index] = value;
    },

    // Render steps
    renderSteps() {
        const list = document.getElementById('stepsList');
        list.innerHTML = this.currentRecipe.steps.map((step, i) => `
            <div class="step-item">
                <span class="step-number">${i + 1}.</span>
                <textarea 
                    placeholder="Opisz ten krok..." 
                    oninput="app.updateStep(${i}, this.value)"
                    rows="2"
                >${step}</textarea>
                ${i > 0 ? `<button class="step-remove" onclick="app.removeStep(${i})">✕</button>` : ''}
            </div>
        `).join('');
    },

    // Save recipe
    saveRecipe() {
        const name = document.getElementById('recipeName').value.trim();
        
        if (!name) {
            alert('Podaj nazwę przepisu!');
            return;
        }
        
        if (this.currentRecipe.ingredients.length === 0) {
            alert('Dodaj przynajmniej jeden składnik!');
            return;
        }
        
        const recipe = {
            id: this.editingRecipe?.id || Date.now(),
            name,
            categories: [...this.currentRecipe.categories],
            tags: [...this.currentRecipe.tags],
            ingredients: [...this.currentRecipe.ingredients],
            steps: this.currentRecipe.steps.filter(s => s.trim()),
            totalCalories: Math.round(this.calculateCalories(this.currentRecipe.ingredients)),
            createdAt: this.editingRecipe?.createdAt || new Date().toISOString()
        };
        
        if (this.editingRecipe) {
            const index = this.recipes.findIndex(r => r.id === this.editingRecipe.id);
            this.recipes[index] = recipe;
        } else {
            this.recipes.push(recipe);
        }
        
        this.saveToStorage();
        this.renderRecipes();
        this.updateFilters();
        this.closeRecipeModal();
    },

    // Edit recipe
    editRecipe(id) {
        const recipe = this.recipes.find(r => r.id === id);
        if (!recipe) return;
        
        this.editingRecipe = recipe;
        this.currentRecipe = {
            name: recipe.name,
            categories: [...recipe.categories],
            tags: [...recipe.tags],
            ingredients: [...recipe.ingredients],
            steps: [...recipe.steps]
        };
        
        document.getElementById('modalTitle').textContent = 'Edytuj przepis';
        document.getElementById('recipeName').value = recipe.name;
        this.renderCategories();
        this.renderTags();
        this.renderIngredients();
        this.renderSteps();
        
        document.getElementById('recipeModal').classList.add('active');
    },

    // Delete recipe
    deleteRecipe(id) {
        if (confirm('Czy na pewno chcesz usunąć ten przepis?')) {
            this.recipes = this.recipes.filter(r => r.id !== id);
            this.saveToStorage();
            this.renderRecipes();
            this.updateFilters();
        }
    },

    // Download recipe as PDF
    downloadPDF(id) {
        const recipe = this.recipes.find(r => r.id === id);
        if (!recipe) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        let y = 20;
        
        // Title
        doc.setFontSize(20);
        doc.text(recipe.name, 20, y);
        y += 15;
        
        // Categories and tags
        doc.setFontSize(10);
        if (recipe.categories.length > 0) {
            doc.text('Kategorie: ' + recipe.categories.join(', '), 20, y);
            y += 7;
        }
        if (recipe.tags.length > 0) {
            doc.text('Tagi: #' + recipe.tags.join(', #'), 20, y);
            y += 10;
        }
        
        // Ingredients
        doc.setFontSize(14);
        doc.text('Skladniki:', 20, y);
        y += 7;
        
        doc.setFontSize(10);
        recipe.ingredients.forEach(ing => {
            const baseIng = this.ingredients[ing.name.toLowerCase()];
            const calories = baseIng ? Math.round((ing.amount / 100) * baseIng.kcal) : 0;
            doc.text(`- ${ing.name}: ${ing.amount}${ing.unit} (${calories} kcal)`, 25, y);
            y += 6;
        });
        
        y += 5;
        doc.setFontSize(12);
        doc.text(`Razem: ${recipe.totalCalories} kcal`, 20, y);
        y += 10;
        
        // Steps
        doc.setFontSize(14);
        doc.text('Przygotowanie:', 20, y);
        y += 7;
        
        doc.setFontSize(10);
        recipe.steps.forEach((step, i) => {
            const lines = doc.splitTextToSize(`${i + 1}. ${step}`, 170);
            lines.forEach(line => {
                if (y > 280) {
                    doc.addPage();
                    y = 20;
                }
                doc.text(line, 20, y);
                y += 6;
            });
            y += 3;
        });
        
        doc.save(`${recipe.name}.pdf`);
    },

    // Show add ingredient modal
    showAddIngredient() {
        document.getElementById('newIngredientName').value = '';
        document.getElementById('newIngredientKcal').value = '';
        document.getElementById('newIngredientUnit').value = '100g';
        document.getElementById('ingredientModal').classList.add('active');
    },

    // Close ingredient modal
    closeIngredientModal() {
        document.getElementById('ingredientModal').classList.remove('active');
    },

    // Save new ingredient
    saveIngredient() {
        const name = document.getElementById('newIngredientName').value.trim().toLowerCase();
        const kcal = parseFloat(document.getElementById('newIngredientKcal').value);
        const unit = document.getElementById('newIngredientUnit').value;
        
        if (!name || !kcal) {
            alert('Wypełnij wszystkie pola!');
            return;
        }
        
        // Add to both ingredients and customIngredients
        this.ingredients[name] = { kcal, unit };
        this.customIngredients[name] = { kcal, unit };
        
        this.saveToStorage();
        this.populateIngredientSelect();
        this.renderIngredientDatabase();
        this.closeIngredientModal();
    }
};

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
