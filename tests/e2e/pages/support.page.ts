import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Page Object for the Support pages (/support, /support/tickets, /support/new).
 *
 * Handles ticket list viewing, ticket creation form, FAQ accordion,
 * and navigation between support pages.
 */
export class SupportPage {
    readonly page: Page;
    readonly newTicketButton: Locator;
    readonly ticketRows: Locator;
    readonly faqAccordion: Locator;
    readonly faqItems: Locator;

    // Create ticket form
    readonly subjectInput: Locator;
    readonly categorySelect: Locator;
    readonly prioritySelect: Locator;
    readonly descriptionTextarea: Locator;
    readonly submitButton: Locator;
    readonly cancelButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.newTicketButton = page.locator('a[href="/support/new"], button', { hasText: 'New Ticket' });
        this.ticketRows = page.locator('[data-testid="ticket-row"]');
        this.faqAccordion = page.locator('[data-testid="faq-accordion"]');
        this.faqItems = page.locator('[data-testid="faq-item"]');

        // Create ticket form
        this.subjectInput = page.locator('input[placeholder*="Subject"]');
        this.categorySelect = page.locator('[data-testid="category-select"]');
        this.prioritySelect = page.locator('[data-testid="priority-select"]');
        this.descriptionTextarea = page.locator('textarea[placeholder*="Description"]');
        this.submitButton = page.locator('button', { hasText: 'Submit Ticket' });
        this.cancelButton = page.locator('button', { hasText: 'Cancel' });
    }

    async gotoSupport(): Promise<void> {
        await this.page.goto('/support');
        await expect(this.page.locator('h1', { hasText: 'Support' })).toBeVisible({ timeout: 15_000 });
    }

    async gotoTickets(): Promise<void> {
        await this.page.goto('/support/tickets');
        await expect(this.page.locator('h1')).toBeVisible({ timeout: 15_000 });
    }

    async gotoNewTicket(): Promise<void> {
        await this.page.goto('/support/new');
        await expect(this.page.locator('h1')).toBeVisible({ timeout: 15_000 });
    }

    async clickNewTicket(): Promise<void> {
        await this.newTicketButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async createTicket(params: {
        subject: string;
        category: 'GENERAL' | 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'BUG' | 'FEATURE_REQUEST';
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        description: string;
    }): Promise<void> {
        await this.subjectInput.fill(params.subject);

        // Select category
        await this.categorySelect.click();
        const categoryMap: Record<string, string> = {
            GENERAL: 'General',
            BILLING: 'Billing',
            TECHNICAL: 'Technical',
            ACCOUNT: 'Account',
            BUG: 'Bug Report',
            FEATURE_REQUEST: 'Feature Request',
        };
        await this.page.locator('text=' + categoryMap[params.category]).click();

        // Select priority
        await this.prioritySelect.click();
        const priorityMap: Record<string, string> = {
            LOW: 'Low',
            MEDIUM: 'Medium',
            HIGH: 'High',
            URGENT: 'Urgent',
        };
        await this.page.locator('text=' + priorityMap[params.priority]).click();

        // Fill description
        await this.descriptionTextarea.fill(params.description);

        // Submit
        await this.submitButton.click();
        await this.page.waitForLoadState('networkidle');
    }

    async getTicketCount(): Promise<number> {
        return await this.ticketRows.count();
    }

    async openFaq(index: number): Promise<void> {
        await this.faqItems.nth(index).click();
        await this.page.waitForLoadState('networkidle');
    }

    async goToTicket(id: string): Promise<void> {
        await this.page.locator(`[data-testid="ticket-${id}"]`).click();
        await this.page.waitForLoadState('networkidle');
    }
}
