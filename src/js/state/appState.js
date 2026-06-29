export class appState {
    /**
     * Initializes the default application view, meal log state, and temporary modal data.
     */
    constructor() {
        this.currentView = 'meals';
        this.loggedItems = JSON.parse(localStorage.getItem('foodLog')) || [];
        this.currentModalServings = 1;
        this.currentMealNutrition = {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0
        };
    }
    
    /**
     * Calculates total nutrition based on servings, logs the meal with timestamps, and saves it to LocalStorage.
     */
    saveLoggedMeal(mealName, mealImg) {
        const servings = this.currentModalServings || 1;
        const base = this.currentMealNutrition;

        // Generate formatted local time string
        const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Construct the logged meal record object
        const loggedMeal = {
            id: Date.now(),
            name: mealName,
            image: mealImg, 
            servings: servings,
            calories: Math.round(base.calories * servings),
            protein: Math.round(base.protein * servings),
            carbs: Math.round(base.carbs * servings),
            fat: Math.round(base.fat * servings),
            date: new Date().toLocaleDateString(),
            time: currentTime 
        };

        // Persist the updated log entries array to local storage
        this.loggedItems.push(loggedMeal);
        localStorage.setItem('foodLog', JSON.stringify(this.loggedItems));

        return loggedMeal;
    }
}