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

        // Create ticket form — use stable element IDs from create-ticket.tsx
        this.subjectInput = page.locator('input#ticket-subject');
        this.categorySelect = page.locator('select#ticket-category');
        this.prioritySelect = page.locator('select#ticket-priority');
        this.descriptionTextarea = page.locator('textarea#ticket-body');
        this.submitButton = page.locator('button', { hasText: 'Submit Ticket' });
        this.cancelButton = page.locator('button', { hasText: 'Cancel' });
    }

    async gotoSupport(): Promise<void> {
        await this.page.goto('/support');
        await expect(this.page.locator('h1', { hasText: 'Support' })).toBeVisible({ timeout: 15_000 });
    }

    async gotoTickets(): Promise<void> {
        // The ticket list lives at /support (not /support/tickets — that
        // would match the /support/:id detail route with id="tickets").
        await this.page.goto('/support');
        await expect(this.page.locator('h1', { hasText: 'Support' })).toBeVisible({ timeout: 15_000 });
    }

    async gotoNewTicket(): Promise<void> {
        await this.page.goto('/support/new');
        await expect(this.page.locator('h1')).toBeVisible({ timeout: 15_000 });
    }

    async clickNewTicket(): Promise<void> {
        await this.newTicketButton.click();
    }

    async createTicket(params: {
        subject: string;
        category: 'GENERAL' | 'BILLING' | 'TECHNICAL' | 'ACCOUNT' | 'BUG' | 'FEATURE_REQUEST';
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        description: string;
    }): Promise<void> {
        await this.subjectInput.fill(params.subject);

        // Select category — native <select> element, use selectOption()
        await this.categorySelect.selectOption(params.category);

        // Select priority if specified (defaults to MEDIUM in UI)
        if (params.priority) {
            await this.prioritySelect.selectOption(params.priority);
        }

        // Fill description
        await this.descriptionTextarea.fill(params.description);

        // Wait for React state to propagate and enable the submit button
        await expect(this.submitButton).toBeEnabled({ timeout: 5_000 });
        await this.submitButton.click();

        // Wait for form submission to complete — the handler navigates to
        // /support/:id on success.  Without this wait, a caller that
        // immediately navigates elsewhere (e.g. gotoTickets) would cancel
        // the in-flight fetch and the ticket would never be persisted.
        await this.page.waitForURL(/\/support\/(?!new)/, { timeout: 15_000 });
    }

    async getTicketCount(): Promise<number> {
        return await this.ticketRows.count();
    }

    async openFaq(index: number): Promise<void> {
        // aria-expanded lives on the inner <Button>, not the wrapper div
        await this.faqItems.nth(index).locator('button').first().click();
    }

    async goToTicket(id: string): Promise<void> {
        await this.page.locator(`[data-testid="ticket-${id}"]`).click();
    }
}
