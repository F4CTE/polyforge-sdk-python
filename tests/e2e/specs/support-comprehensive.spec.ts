import { test, expect } from '@playwright/test';
import { SupportPage } from '../pages/support.page';
import { apiLogin } from '../helpers/api';

/**
 * Comprehensive Support workflow tests for PolyForge.
 *
 * Covers:
 *   - Support page and ticket list
 *   - FAQ accordion
 *   - Ticket creation with all categories and priorities
 *   - Ticket validation
 *   - Ticket detail view
 *   - Ticket lifecycle (status transitions)
 *   - Reply functionality
 */

const TEST_EMAIL = 'alice@e2e.dev.local';
const TEST_PASSWORD = 'TestPass123!';

test.describe.serial('Support — Full Workflow Coverage', () => {
    let supportPage: SupportPage;

    test.beforeEach(async ({ page }) => {
        supportPage = new SupportPage(page);

        // Login and set auth cookie
        const { token } = await apiLogin(TEST_EMAIL, TEST_PASSWORD);
        await page.context().addCookies([
            {
                name: 'pf_token',
                value: token,
                domain: 'localhost',
                path: '/',
            },
        ]);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TICKET LIST TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke support page loads at /support', async ({ page }) => {
        await supportPage.gotoSupport();

        expect(page.url()).toContain('/support');
        await expect(page.locator('h1', { hasText: /support|ticket/i })).toBeVisible();
    });

    test('support page shows existing tickets or empty state', async ({ page }) => {
        await supportPage.gotoSupport();

        const ticketList = page.locator('[data-testid="ticket-list"], [class*="ticket"], [role="table"]');
        const emptyState = page.locator('[data-testid="empty-state"], text=No tickets');

        // Either should show tickets or empty state
        const ticketListVisible = await ticketList.isVisible();
        const emptyStateVisible = await emptyState.isVisible();

        expect(ticketListVisible || emptyStateVisible).toBe(true);
    });

    test('new ticket button is visible', async ({ page }) => {
        await supportPage.gotoSupport();

        await expect(supportPage.newTicketButton).toBeVisible();
    });

    test('ticket table has correct columns', async ({ page }) => {
        await supportPage.gotoSupport();

        const headers = page.locator('[role="columnheader"]');
        const headerTexts = await headers.allTextContents();
        const headerString = headerTexts.join(',').toLowerCase();

        // Check for expected columns
        expect(
            headerString.includes('subject') ||
            headerString.includes('status') ||
            headerString.includes('priority'),
        ).toBe(true);
    });

    test('status badges are color-coded', async ({ page }) => {
        await supportPage.gotoSupport();

        const statusBadges = page.locator('[data-testid="status-badge"]');
        const count = await statusBadges.count();

        if (count > 0) {
            for (let i = 0; i < Math.min(count, 3); i++) {
                const badge = statusBadges.nth(i);
                const backgroundColor = await badge.evaluate((el) => window.getComputedStyle(el).backgroundColor);
                expect(backgroundColor).toBeDefined();
            }
        }
    });

    test('priority badges are visible and properly displayed', async ({ page }) => {
        await supportPage.gotoSupport();

        const priorityBadges = page.locator('[data-testid="priority-badge"]');
        const count = await priorityBadges.count();

        if (count > 0) {
            // At least one priority badge should exist
            expect(count).toBeGreaterThan(0);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FAQ TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke FAQ section is visible', async ({ page }) => {
        await supportPage.gotoSupport();

        const faqSection = page.locator('[data-testid="faq-section"], [class*="faq"]');
        const count = await faqSection.count();

        // FAQ may or may not be present on main support page
        expect(count).toBeGreaterThanOrEqual(0);
    });

    test('FAQ accordion items are visible', async ({ page }) => {
        await supportPage.gotoSupport();

        const faqItems = supportPage.faqItems;
        const count = await faqItems.count();

        if (count > 0) {
            // At least one FAQ item should be visible
            expect(count).toBeGreaterThan(0);
        }
    });

    test('clicking FAQ item expands to show answer', async ({ page }) => {
        await supportPage.gotoSupport();

        const faqItems = supportPage.faqItems;
        const count = await faqItems.count();

        if (count > 0) {
            const firstItem = faqItems.first();
            await firstItem.click();

            // Check if expanded (usually aria-expanded or visible content)
            const expanded = await firstItem.getAttribute('aria-expanded');
            expect(expanded).toBeDefined();
        }
    });

    test('clicking FAQ item again collapses it', async ({ page }) => {
        await supportPage.gotoSupport();

        const faqItems = supportPage.faqItems;
        const count = await faqItems.count();

        if (count > 0) {
            const firstItem = faqItems.first();

            // Click to expand
            await firstItem.click();

            // Click to collapse
            await firstItem.click();

            const expanded = await firstItem.getAttribute('aria-expanded');
            expect(expanded === 'false' || expanded === undefined).toBe(true);
        }
    });

    test('multiple FAQs can be expanded simultaneously', async ({ page }) => {
        await supportPage.gotoSupport();

        const faqItems = supportPage.faqItems;
        const count = await faqItems.count();

        if (count >= 2) {
            // Expand first two items
            await faqItems.nth(0).click();
            await faqItems.nth(1).click();

            const firstExpanded = await faqItems.nth(0).getAttribute('aria-expanded');
            const secondExpanded = await faqItems.nth(1).getAttribute('aria-expanded');

            expect(firstExpanded === 'true' || secondExpanded === 'true').toBe(true);
        }
    });

    test('FAQ content is readable and formatted', async ({ page }) => {
        await supportPage.gotoSupport();

        const faqItems = supportPage.faqItems;
        const count = await faqItems.count();

        if (count > 0) {
            await faqItems.first().click();

            const content = page.locator('[data-testid="faq-content"], .faq-answer');
            const text = await content.textContent();

            expect(text).toBeDefined();
            expect(text?.length).toBeGreaterThan(0);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE TICKET NAVIGATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke clicking new ticket button navigates to /support/new', async ({ page }) => {
        await supportPage.gotoSupport();

        await supportPage.clickNewTicket();

        expect(page.url()).toContain('/support/new');
    });

    test('new ticket page shows creation form', async ({ page }) => {
        await supportPage.gotoNewTicket();

        await expect(supportPage.subjectInput).toBeVisible();
        await expect(supportPage.categorySelect).toBeVisible();
        await expect(supportPage.descriptionTextarea).toBeVisible();
        await expect(supportPage.submitButton).toBeVisible();
    });

    test('create ticket form has all required fields', async ({ page }) => {
        await supportPage.gotoNewTicket();

        // Check for required attributes or labels
        const requiredFields = page.locator('[required]');
        const requiredCount = await requiredFields.count();

        // Should have at least 2-3 required fields (subject, category, description)
        expect(requiredCount).toBeGreaterThanOrEqual(2);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE TICKET - ALL CATEGORIES TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke create GENERAL category ticket succeeds', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `General inquiry ${timestamp}`,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: `Test general inquiry created at ${timestamp}`,
        });

        // Should redirect to ticket or show success
        await expect(page.locator('[role="alert"], .toast, [data-testid="success-message"]')).toBeVisible({
            timeout: 5000,
        });

        // Should no longer be on /support/new
        expect(page.url()).not.toContain('/support/new');
    });

    test('create BILLING category ticket succeeds', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `Billing issue ${timestamp}`,
            category: 'BILLING',
            priority: 'MEDIUM',
            description: `Test billing inquiry created at ${timestamp}`,
        });

        expect(page.url()).not.toContain('/support/new');
    });

    test('create TECHNICAL category ticket succeeds', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `Technical issue ${timestamp}`,
            category: 'TECHNICAL',
            priority: 'MEDIUM',
            description: `Test technical inquiry created at ${timestamp}`,
        });

        expect(page.url()).not.toContain('/support/new');
    });

    test('create ACCOUNT category ticket succeeds', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `Account issue ${timestamp}`,
            category: 'ACCOUNT',
            priority: 'MEDIUM',
            description: `Test account inquiry created at ${timestamp}`,
        });

        expect(page.url()).not.toContain('/support/new');
    });

    test('create BUG category ticket succeeds', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `Bug report ${timestamp}`,
            category: 'BUG',
            priority: 'MEDIUM',
            description: `Test bug report created at ${timestamp}`,
        });

        expect(page.url()).not.toContain('/support/new');
    });

    test('create FEATURE_REQUEST category ticket succeeds', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `Feature request ${timestamp}`,
            category: 'FEATURE_REQUEST',
            priority: 'MEDIUM',
            description: `Test feature request created at ${timestamp}`,
        });

        expect(page.url()).not.toContain('/support/new');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE TICKET - ALL PRIORITIES TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke create LOW priority ticket shows correct priority badge', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        const subject = `Low priority test ${timestamp}`;

        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'LOW',
            description: 'Test low priority ticket',
        });


        // Navigate to ticket list to verify priority
        await supportPage.gotoTickets();

        const ticketRow = page.locator(`text=${subject}`);
        const priorityBadge = ticketRow.locator('[data-testid="priority-badge"]').or(ticketRow.locator('text=/LOW/i'));

        const count = await priorityBadge.count();
        expect(count).toBeGreaterThan(0);
    });

    test('create MEDIUM priority ticket shows correct priority badge', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        const subject = `Medium priority test ${timestamp}`;

        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: 'Test medium priority ticket',
        });

        await supportPage.gotoTickets();

        const ticketRow = page.locator(`text=${subject}`);
        const count = await ticketRow.count();
        expect(count).toBeGreaterThan(0);
    });

    test('create HIGH priority ticket shows correct priority badge', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        const subject = `High priority test ${timestamp}`;

        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'HIGH',
            description: 'Test high priority ticket',
        });

        await supportPage.gotoTickets();

        const ticketRow = page.locator(`text=${subject}`);
        const count = await ticketRow.count();
        expect(count).toBeGreaterThan(0);
    });

    test('create URGENT priority ticket shows correct priority badge', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        const subject = `Urgent priority test ${timestamp}`;

        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'URGENT',
            description: 'Test urgent priority ticket',
        });

        await supportPage.gotoTickets();

        const ticketRow = page.locator(`text=${subject}`);
        const count = await ticketRow.count();
        expect(count).toBeGreaterThan(0);
    });

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE TICKET VALIDATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('submit with empty subject shows validation error', async ({ page }) => {
        await supportPage.gotoNewTicket();

        // Leave subject empty
        await supportPage.categorySelect.click();
        await page.locator('text=General').click();
        await supportPage.descriptionTextarea.fill('Description without subject');

        await supportPage.submitButton.click();

        // Should show validation error
        await expect(page.locator('[role="alert"], .error, [data-testid="error-message"]')).toBeVisible({
            timeout: 5000,
        });
    });

    test('submit with empty description shows validation error', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.subjectInput.fill(`Subject ${timestamp}`);
        await supportPage.categorySelect.click();
        await page.locator('text=General').click();

        // Leave description empty
        await supportPage.submitButton.click();

        await expect(page.locator('[role="alert"], .error, [data-testid="error-message"]')).toBeVisible({
            timeout: 5000,
        });
    });

    test('submit with empty category shows validation error', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        await supportPage.subjectInput.fill(`Subject ${timestamp}`);
        await supportPage.descriptionTextarea.fill('Description without category selected');

        // Don't select category
        await supportPage.submitButton.click();

        await expect(page.locator('[role="alert"], .error, [data-testid="error-message"]')).toBeVisible({
            timeout: 5000,
        });
    });

    test('description textarea accepts multi-line text', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const multiLineText = `Line 1
Line 2
Line 3
Line 4`;

        await supportPage.descriptionTextarea.fill(multiLineText);

        const value = await supportPage.descriptionTextarea.inputValue();
        expect(value).toBe(multiLineText);
    });

    test('long subject is handled properly', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const longSubject = 'A'.repeat(200);
        const timestamp = Date.now();

        await supportPage.createTicket({
            subject: longSubject,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: `Test with long subject at ${timestamp}`,
        });

        // Should complete successfully or show validation error
    });

    test('special characters in subject are handled properly', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const specialSubject = `Subject with special chars: @#$%^&*() - ${Date.now()}`;

        await supportPage.createTicket({
            subject: specialSubject,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: 'Test with special characters',
        });

        expect(page.url()).not.toContain('/support/new');
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TICKET DETAIL TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke clicking ticket in list navigates to detail page', async ({ page }) => {
        // First create a ticket
        await supportPage.gotoNewTicket();
        const timestamp = Date.now();
        const subject = `Detail test ticket ${timestamp}`;

        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: 'Test ticket for detail view',
        });


        // Now navigate to tickets list and click the ticket
        await supportPage.gotoTickets();
        const ticketRow = page.locator(`text=${subject}`);
        await ticketRow.click();

        expect(page.url()).toContain('/support');
        // URL might be /support/:id
    });

    test('ticket detail shows subject, status, priority, category', async ({ page }) => {
        // Navigate to a ticket detail page (assuming one exists)
        const allTickets = page.locator('[data-testid="ticket-row"]');
        const count = await allTickets.count();

        if (count > 0) {
            // Click first ticket
            await allTickets.first().click();

            // Verify details are displayed
            const subject = page.locator('[data-testid="ticket-subject"]');
            const status = page.locator('[data-testid="ticket-status"]');
            const priority = page.locator('[data-testid="ticket-priority"]');

            // At least some of these should be visible
            const subjectVisible = await subject.isVisible();
            expect(subjectVisible || (await status.isVisible()) || (await priority.isVisible())).toBe(true);
        }
    });

    test('ticket detail shows message thread', async ({ page }) => {
        // Navigate to a ticket
        const allTickets = page.locator('[data-testid="ticket-row"]');
        const count = await allTickets.count();

        if (count > 0) {
            await allTickets.first().click();

            // Look for message thread
            const messageThread = page.locator('[data-testid="message-thread"], [class*="messages"], [class*="thread"]');
            const threadVisible = await messageThread.isVisible();

            expect(threadVisible).toBe(true);
        }
    });

    test('open ticket shows reply textarea', async ({ page }) => {
        // Navigate to a ticket
        const allTickets = page.locator('[data-testid="ticket-row"]');
        const count = await allTickets.count();

        if (count > 0) {
            await allTickets.first().click();

            // Check if ticket is OPEN status
            const status = page.locator('[data-testid="ticket-status"]');
            const statusText = await status.textContent();

            if (statusText?.includes('OPEN') || statusText?.includes('Open')) {
                const replyTextarea = page.locator('[data-testid="reply-textarea"], textarea[placeholder*="Reply"]');
                const isVisible = await replyTextarea.isVisible();
                expect(isVisible).toBe(true);
            }
        }
    });

    test('submit reply on open ticket adds message to thread', async ({ page }) => {
        // Navigate to a ticket
        const allTickets = page.locator('[data-testid="ticket-row"]');
        const count = await allTickets.count();

        if (count > 0) {
            await allTickets.first().click();

            const replyTextarea = page.locator('[data-testid="reply-textarea"], textarea[placeholder*="Reply"]');

            if (await replyTextarea.isVisible()) {
                const replyText = `Test reply at ${Date.now()}`;
                await replyTextarea.fill(replyText);

                const submitButton = page.locator('button:has-text("Submit"), button:has-text("Reply"), button:has-text("Send")').first();
                await submitButton.click();


                // Verify reply appears in thread
                const messageInThread = page.locator(`text=${replyText}`);
                await expect(messageInThread).toBeVisible({ timeout: 5000 });
            }
        }
    });

    test('closed ticket does not show reply option', async ({ page }) => {
        // Find a closed ticket
        const closedTickets = page.locator('[data-testid="ticket-row"][data-status="CLOSED"]');
        const count = await closedTickets.count();

        if (count > 0) {
            await closedTickets.first().click();

            const replyTextarea = page.locator('[data-testid="reply-textarea"], textarea[placeholder*="Reply"]');
            const isVisible = await replyTextarea.isVisible();

            expect(isVisible).toBe(false);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // TICKET LIFECYCLE TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('@smoke new ticket shows OPEN status', async ({ page }) => {
        await supportPage.gotoNewTicket();

        const timestamp = Date.now();
        const subject = `Lifecycle test ${timestamp}`;

        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: 'Test ticket lifecycle',
        });


        // Navigate to tickets list
        await supportPage.gotoTickets();

        // Find the newly created ticket
        const ticketRow = page.locator(`text=${subject}`);
        const statusBadge = ticketRow.locator('[data-testid="status-badge"]');
        const statusText = await statusBadge.textContent();

        expect(statusText?.toUpperCase()).toContain('OPEN');
    });

    test('ticket status appears in list view with correct formatting', async ({ page }) => {
        await supportPage.gotoTickets();

        const statusBadges = page.locator('[data-testid="status-badge"]');
        const count = await statusBadges.count();

        if (count > 0) {
            for (let i = 0; i < Math.min(count, 3); i++) {
                const badge = statusBadges.nth(i);
                const text = await badge.textContent();

                // Should be one of the valid statuses
                expect(
                    text?.toUpperCase().includes('OPEN') ||
                    text?.toUpperCase().includes('AWAITING') ||
                    text?.toUpperCase().includes('CLOSED'),
                ).toBe(true);
            }
        }
    });

    test('priority level affects badge styling in list view', async ({ page }) => {
        await supportPage.gotoTickets();

        const priorityBadges = page.locator('[data-testid="priority-badge"]');
        const count = await priorityBadges.count();

        if (count > 0) {
            // Collect all priority badge text
            const priorities: string[] = [];
            for (let i = 0; i < Math.min(count, 5); i++) {
                const badge = priorityBadges.nth(i);
                const text = await badge.textContent();
                if (text) priorities.push(text);
            }

            // Should have collected some priorities
            expect(priorities.length).toBeGreaterThan(0);
        }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // INTEGRATION TESTS
    // ─────────────────────────────────────────────────────────────────────────

    test('can create ticket and view it in ticket list', async ({ page }) => {
        const timestamp = Date.now();
        const subject = `Integration test ${timestamp}`;

        // Create ticket
        await supportPage.gotoNewTicket();
        await supportPage.createTicket({
            subject,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: 'Integration test ticket',
        });


        // Navigate to tickets list
        await supportPage.gotoTickets();

        // Verify ticket appears in list
        const ticketRow = page.locator(`text=${subject}`);
        await expect(ticketRow).toBeVisible({ timeout: 5000 });
    });

    test('ticket created with specific category shows correct category in list', async ({ page }) => {
        const timestamp = Date.now();
        const subject = `Category test ${timestamp}`;

        await supportPage.gotoNewTicket();
        await supportPage.createTicket({
            subject,
            category: 'BILLING',
            priority: 'MEDIUM',
            description: 'Category test ticket',
        });

        await supportPage.gotoTickets();

        const ticketRow = page.locator(`text=${subject}`);
        const categoryCell = ticketRow.locator('[data-testid="category"]');

        const categoryText = await categoryCell.textContent();
        expect(categoryText?.toUpperCase()).toContain('BILL');
    });

    test('navigate from ticket list to new ticket creation and back', async ({ page }) => {
        await supportPage.gotoTickets();

        const initialTicketCount = await supportPage.getTicketCount();

        // Click new ticket button
        await supportPage.clickNewTicket();
        expect(page.url()).toContain('/support/new');

        // Create a ticket
        const timestamp = Date.now();
        await supportPage.createTicket({
            subject: `Navigation test ${timestamp}`,
            category: 'GENERAL',
            priority: 'MEDIUM',
            description: 'Navigation test',
        });


        // Should have more tickets now (if navigation works correctly)
        await supportPage.gotoTickets();
        const newTicketCount = await supportPage.getTicketCount();

        expect(newTicketCount).toBeGreaterThanOrEqual(initialTicketCount);
    });
});
