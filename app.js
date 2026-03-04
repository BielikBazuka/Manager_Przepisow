// Recipe Manager Application
const app = {
    recipes: [],
    ingredients: {},
    currentRecipe: null,
    editingRecipe: null,

    // ─── JSONBin config ────────────────────────────────────────────────────────
    BIN_ID:  '69a8151943b1c97be9b26a81
    API_KEY: '$2a$10$mSZ34uDjWfYsW2LhVV44i.r8ZC4g0IouOa4/JyeZfZcQkllXhM/Vq',  // e.g. '$2a$10$...'
    get BIN_URL() {
        return `https://api.jsonbin.io/v3/b/${this.BIN_ID}`;
    },
    // ──────────────────────────────────────────────────────────────────────────

    async init() {
        // Load ingredients from ingredients.js as fallback base
        this.ingredients = { ...INGREDIENTS_DB } || {};

        // Show loading state
        document.getElementById('recipesGrid').innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">⏳</div>
                <p>Ładowanie przepisów...</p>
            </div>`;

        // Load from JSONBin (shared across all devices)
        try {
            const res = await fetch(this.BIN_URL + '/latest', {
                headers: { 'X-Master-Key': this.API_KEY }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const record = data.record;

            if (record.recipes)    this.recipes     = record.recipes;
            if (record.ingredients) this.ingredients = { ...this.ingredients, ...record.ingredients };

        } catch (err) {
            console.error('JSONBin load failed:', err);
            alert('Nie udało się załadować danych. Sprawdź połączenie lub konfigurację JSONBin.');
        }

        // Populate ingredient select
        this.populateIngredientSelect();

        // Render everything
        this.renderRecipes();
        this.renderIngredientDatabase();
        this.updateFilters();

        // Default current recipe
        this.currentRecipe = { name: '', categories: [], tags: [], ingredients: [], steps: [''] };
    },

    // Save recipes to JSONBin (replaces localStorage)
    async saveToStorage() {
        // Only save user-added ingredients (not the base INGREDIENTS_DB ones)
        const userIngredients = {};
        for (const [key, val] of Object.entries(this.ingredients)) {
            if (!INGREDIENTS_DB[key]) userIngredients[key] = val;
        }

        try {
            const res = await fetch(this.BIN_URL, {
                method:  'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.API_KEY
                },
                body: JSON.stringify({ recipes: this.recipes, ingredients: userIngredients })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            console.error('JSONBin save failed:', err);
            alert('Nie udało się zapisać danych. Sprawdź połączenie.');
        }
    },

    // Populate ingredient dropdown
    populateIngredientSelect() {
        const select = document.getElementById('ingredientSelect');
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
        
        const categoryFilter = document.getElementById('categoryFilter');
        categoryFilter.innerHTML = '<option value="all">Wszystkie kategorie</option>';
        Array.from(categories).sort().forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categoryFilter.appendChild(option);
        });
        
        const tagFilter = document.getElementById('tagFilter');
        tagFilter.innerHTML = '<option value="all">Wszystkie tagi</option>';
        Array.from(tags).sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = `#${tag}`;
            tagFilter.appendChild(option);
        });
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
        
        if (recipesToRender.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon">🍽️</div>
                    <p>${this.recipes.length === 0 ? 'Brak przepisów. Dodaj swój pierwszy przepis!' : 'Nie znaleziono przepisów.'}</p>
                </div>`;
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
                            </div>`;
                    }).join('')}
                </div>
                
                <div class="steps-section">
                    <h4>👨‍🍳 Przygotowanie:</h4>
                    <ol>${recipe.steps.filter(s => s).map(step => `<li>${step}</li>`).join('')}</ol>
                </div>
                
                <div class="total-calories">🔥 Razem: ${recipe.totalCalories} kcal</div>
            </div>
        `).join('');
    },

    // Render ingredient database
    renderIngredientDatabase() {
        const list = document.getElementById('ingredientsList');
        const count = document.getElementById('ingredientCount');
        
        count.textContent = Object.keys(this.ingredients).length;
        
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
        this.currentRecipe = { name: '', categories: [], tags: [], ingredients: [], steps: [''] };
        
        document.getElementById('modalTitle').textContent = 'Nowy przepis';
        document.getElementById('recipeName').value = '';
        document.getElementById('categoriesList').innerHTML = '';
        document.getElementById('tagsList').innerHTML = '';
        document.getElementById('ingredientItems').innerHTML = '';
        document.getElementById('totalCalories').innerHTML = '';
        this.renderSteps();
        
        document.getElementById('recipeModal').classList.add('active');
    },

    closeRecipeModal() {
        document.getElementById('recipeModal').classList.remove('active');
    },

    addCategory() {
        const input = document.getElementById('categoryInput');
        const value = input.value.trim();
        if (value && !this.currentRecipe.categories.includes(value)) {
            this.currentRecipe.categories.push(value);
            this.renderCategories();
            input.value = '';
        }
    },

    removeCategory(index) {
        this.currentRecipe.categories.splice(index, 1);
        this.renderCategories();
    },

    renderCategories() {
        const list = document.getElementById('categoriesList');
        list.innerHTML = this.currentRecipe.categories.map((cat, i) => `
            <span class="tag tag-category">
                ${cat}
                <button onclick="app.removeCategory(${i})">✕</button>
            </span>
        `).join('');
    },

    addTag() {
        const input = document.getElementById('tagInput');
        const value = input.value.trim();
        if (value && !this.currentRecipe.tags.includes(value)) {
            this.currentRecipe.tags.push(value);
            this.renderTags();
            input.value = '';
        }
    },

    removeTag(index) {
        this.currentRecipe.tags.splice(index, 1);
        this.renderTags();
    },

    renderTags() {
        const list = document.getElementById('tagsList');
        list.innerHTML = this.currentRecipe.tags.map((tag, i) => `
            <span class="tag tag-item">
                #${tag}
                <button onclick="app.removeTag(${i})">✕</button>
            </span>
        `).join('');
    },

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

    removeIngredient(index) {
        this.currentRecipe.ingredients.splice(index, 1);
        this.renderIngredients();
    },

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
                </div>`;
        }).join('');
        
        const total = Math.round(this.calculateCalories(this.currentRecipe.ingredients));
        totalDiv.innerHTML = this.currentRecipe.ingredients.length > 0 ? `🔥 Razem: ${total} kcal` : '';
    },

    addStep() {
        this.currentRecipe.steps.push('');
        this.renderSteps();
    },

    removeStep(index) {
        if (this.currentRecipe.steps.length > 1) {
            this.currentRecipe.steps.splice(index, 1);
            this.renderSteps();
        }
    },

    updateStep(index, value) {
        this.currentRecipe.steps[index] = value;
    },

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

    // Save recipe — now async because saveToStorage is async
    async saveRecipe() {
        const name = document.getElementById('recipeName').value.trim();
        
        if (!name) { alert('Podaj nazwę przepisu!'); return; }
        if (this.currentRecipe.ingredients.length === 0) { alert('Dodaj przynajmniej jeden składnik!'); return; }
        
        const recipe = {
            id: this.editingRecipe?.id || Date.now(),
            name,
            categories: [...this.currentRecipe.categories],
            tags:       [...this.currentRecipe.tags],
            ingredients:[...this.currentRecipe.ingredients],
            steps:      this.currentRecipe.steps.filter(s => s.trim()),
            totalCalories: Math.round(this.calculateCalories(this.currentRecipe.ingredients)),
            createdAt:  this.editingRecipe?.createdAt || new Date().toISOString()
        };
        
        if (this.editingRecipe) {
            const index = this.recipes.findIndex(r => r.id === this.editingRecipe.id);
            this.recipes[index] = recipe;
        } else {
            this.recipes.push(recipe);
        }
        
        await this.saveToStorage();
        this.renderRecipes();
        this.updateFilters();
        this.closeRecipeModal();
    },

    editRecipe(id) {
        const recipe = this.recipes.find(r => r.id === id);
        if (!recipe) return;
        
        this.editingRecipe = recipe;
        this.currentRecipe = {
            name:        recipe.name,
            categories: [...recipe.categories],
            tags:       [...recipe.tags],
            ingredients:[...recipe.ingredients],
            steps:      [...recipe.steps]
        };
        
        document.getElementById('modalTitle').textContent = 'Edytuj przepis';
        document.getElementById('recipeName').value = recipe.name;
        this.renderCategories();
        this.renderTags();
        this.renderIngredients();
        this.renderSteps();
        
        document.getElementById('recipeModal').classList.add('active');
    },

    async deleteRecipe(id) {
        if (confirm('Czy na pewno chcesz usunąć ten przepis?')) {
            this.recipes = this.recipes.filter(r => r.id !== id);
            await this.saveToStorage();
            this.renderRecipes();
            this.updateFilters();
        }
    },

    downloadPDF(id) {
        const recipe = this.recipes.find(r => r.id === id);
        if (!recipe) return;
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;
        
        doc.setFontSize(20);
        doc.text(recipe.name, 20, y);
        y += 15;
        
        doc.setFontSize(10);
        if (recipe.categories.length > 0) { doc.text('Kategorie: ' + recipe.categories.join(', '), 20, y); y += 7; }
        if (recipe.tags.length > 0)       { doc.text('Tagi: #' + recipe.tags.join(', #'), 20, y); y += 10; }
        
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
        
        doc.setFontSize(14);
        doc.text('Przygotowanie:', 20, y);
        y += 7;
        
        doc.setFontSize(10);
        recipe.steps.forEach((step, i) => {
            const lines = doc.splitTextToSize(`${i + 1}. ${step}`, 170);
            lines.forEach(line => {
                if (y > 280) { doc.addPage(); y = 20; }
                doc.text(line, 20, y);
                y += 6;
            });
            y += 3;
        });
        
        doc.save(`${recipe.name}.pdf`);
    },

    showAddIngredient() {
        document.getElementById('newIngredientName').value = '';
        document.getElementById('newIngredientKcal').value = '';
        document.getElementById('newIngredientUnit').value = '100g';
        document.getElementById('ingredientModal').classList.add('active');
    },

    closeIngredientModal() {
        document.getElementById('ingredientModal').classList.remove('active');
    },

    async saveIngredient() {
        const name = document.getElementById('newIngredientName').value.trim().toLowerCase();
        const kcal = parseFloat(document.getElementById('newIngredientKcal').value);
        const unit = document.getElementById('newIngredientUnit').value;
        
        if (!name || !kcal) { alert('Wypełnij wszystkie pola!'); return; }
        
        this.ingredients[name] = { kcal, unit };
        await this.saveToStorage();
        this.populateIngredientSelect();
        this.renderIngredientDatabase();
        this.closeIngredientModal();
    }
};

document.addEventListener('DOMContentLoaded', () => { app.init(); });



