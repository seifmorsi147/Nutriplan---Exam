//& Import Modules
import { appState } from "./state/appState.js";
import { uiManager } from "./ui/uiManager.js";
import { mealApi } from "./API/mealdb.js";

class App {
    /**
     * Initializes core modules, sets up initial views, and handles the loading screen overlay.
     */
    constructor() {
        this.state = new appState();
        this.ui = new uiManager(this);
        this.api = new mealApi();
        
        this.initModalEvents();
        this.ui.renderWeeklyOverview();
        
        // Handle application loading screen timeout
        this.loadingOver = document.getElementById('app-loading-overlay');
        setTimeout(() => {
            this.loadingOver.classList.add('loading-hidden');
            this.ui.navigateTo('home');
            setTimeout(() => {
                this.loadingOver.style.display = 'none';
            }, 500);
        }, 1400);
    }
    
    /**
     * Attaches event listeners for the meal logging modal and data clearing.
     */
    initModalEvents() {
        // Increase serving count
        document.getElementById('btn-plus-serving')?.addEventListener('click', () => {
            this.state.currentModalServings++;
            this.ui.updateModalNutritionDOM();
        });

        // Decrease serving count (minimum 1)
        document.getElementById('btn-minus-serving')?.addEventListener('click', () => {
            if (this.state.currentModalServings > 1) {
                this.state.currentModalServings--;
                this.ui.updateModalNutritionDOM();
            }
        });

        // Close the meal modal
        document.getElementById('btn-close-modal')?.addEventListener('click', () => {
            document.getElementById('log-meal-modal').classList.add('hidden');
        });

        // Confirm and save the logged meal, then trigger success alert
        document.getElementById('btn-confirm-log')?.addEventListener('click', () => {
            const currentMeal = this.ui.currentActiveMeal;

            if (currentMeal) {
                const savedData = this.state.saveLoggedMeal(currentMeal.strMeal, currentMeal.strMealThumb);

                document.getElementById('log-meal-modal').classList.add('hidden');

                if (typeof this.ui.renderFoodLog === 'function') {
                    this.ui.renderFoodLog();
                }

                // Success notification using SweetAlert
                Swal.fire({
                    icon: 'success',
                    iconColor: '#10b981',
                    title: '<span class="text-2xl font-bold text-gray-900">Meal Logged!</span>',
                    html: `
                    <p class="text-sm text-gray-500 mb-2">${savedData.name} (${savedData.servings} serving${savedData.servings > 1 ? 's' : ''}) has been added to your daily log.</p>
                    <p class="text-lg font-bold text-emerald-600">+${savedData.calories} calories</p>
                `,
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true,
                    customClass: {
                        popup: 'rounded-3xl p-8 max-w-sm w-full text-center'
                    }
                });
            }
        });

        // Clear all logged meals for today with confirmation alert
        document.getElementById('clear-foodlog')?.addEventListener('click', () => {
            Swal.fire({
                title: 'Are you sure?',
                text: "This will clear all logged meals for today!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                confirmButtonText: 'Yes, clear it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Reset state and LocalStorage logs
                    this.state.loggedItems = [];
                    localStorage.setItem('foodLog', JSON.stringify([]));

                    // Reset today's data in the weekly summary
                    let weeklySummary = JSON.parse(localStorage.getItem('weeklySummary')) || {};
                    const todayStr = new Date().toLocaleDateString('en-US');

                    weeklySummary[todayStr] = {
                        calories: 0,
                        itemsCount: 0
                    };
                    localStorage.setItem('weeklySummary', JSON.stringify(weeklySummary));

                    // Refresh UI components
                    this.ui.renderFoodLog();
                    this.ui.renderWeeklyOverview(); 
                    this.ui.showToast("All items cleared");
                }
            });
        });
    }
}

// Bootstrap the application once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new App();
});